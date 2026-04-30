import type { PatternTaskRecord } from './pcs-pattern-task-types.ts'
import type { PlateMakingTaskRecord } from './pcs-plate-making-types.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'

export type EngineeringTaskFieldPolicyCode = 'REVISION_TASK' | 'PATTERN_TASK' | 'PATTERN_ARTWORK_TASK'

export interface EngineeringTaskFieldDescriptor {
  fieldKey: string
  label: string
}

export interface EngineeringTaskNodeWritebackDescriptor {
  phase: '创建后' | '完成后'
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
    { fieldKey: 'patternPieceImageIds', label: '唛架图片' },
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
  ],
  completionRequiredFields: [
    { fieldKey: 'artworkVersion', label: '花型版次' },
    { fieldKey: 'buyerReviewStatus', label: '买手确认通过' },
    { fieldKey: 'completionImageIds', label: '完成确认图片' },
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
  const missing: string[] = []
  if (!(task.patternMakerName || task.ownerName).trim()) missing.push('版师')
  if (!task.productHistoryType) missing.push('产品历史属性')
  if (!task.patternArea) missing.push('打版区域')
  const hasPatternImage = (task.patternImageLineItems || []).length > 0
  const hasPatternFile =
    (task.patternPdfFileIds || []).length > 0
    || (task.patternDxfFileIds || []).length > 0
    || (task.patternRulFileIds || []).length > 0
  if (!hasPatternImage && !hasPatternFile && !task.patternVersion.trim()) missing.push('纸样资料')
  return missing
}

export function getPatternTaskCompletionMissingFields(task: PatternTaskRecord): string[] {
  const missing: string[] = []
  if (!task.artworkVersion.trim()) missing.push('花型版次')
  if (task.buyerReviewStatus !== '买手已通过') missing.push('买手确认通过')
  if (task.completionImageIds.length === 0) missing.push('完成确认图片')
  return missing
}
