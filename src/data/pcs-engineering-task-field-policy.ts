import type { PatternTaskRecord } from './pcs-pattern-task-types.ts'
import type { PlateMakingTaskRecord } from './pcs-plate-making-types.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'

export type EngineeringTaskFieldPolicyCode = 'REVISION_TASK' | 'PATTERN_TASK' | 'PATTERN_ARTWORK_TASK'

export interface EngineeringTaskFieldDescriptor {
  fieldKey: string
  label: string
  description: string
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
    { fieldKey: 'title', label: '任务标题', description: '在项目节点创建时明确本次改版主题。' },
    { fieldKey: 'ownerName', label: '负责人', description: '节点推进时必须指定当前主责人。' },
    { fieldKey: 'dueAt', label: '截止时间', description: '用于锁定本次改版的计划完成时间。' },
    { fieldKey: 'revisionScopeCodes', label: '改版范围', description: '明确本次改版涉及的版型、工艺、花型等范围。' },
    { fieldKey: 'baseStyleCode', label: '旧款信息', description: '明确本次改版基于的既有款式。' },
    { fieldKey: 'issueSummary', label: '问题点', description: '记录本次改版要解决的核心问题。' },
    { fieldKey: 'evidenceSummary', label: '证据说明', description: '记录支撑改版的评审、反馈和比对证据。' },
  ],
  detailEditableFields: [
    { fieldKey: 'participantNames', label: '参与人', description: '在实例详情中补齐实际参与执行的人员。' },
    { fieldKey: 'revisionVersion', label: '改版版次', description: '在实例详情中补齐本次改版产出的版次标记。' },
    { fieldKey: 'sampleQty', label: '样衣数量', description: '记录本次改版需要产出的样衣数量。' },
    { fieldKey: 'materialAdjustmentLines', label: '面辅料变化', description: '记录本次改版涉及的面辅料变化明细。' },
    { fieldKey: 'newPatternSpuCode', label: '新花型 SPU', description: '记录改版涉及的新花型方向。' },
    { fieldKey: 'patternPieceImageIds', label: '纸样图片', description: '记录本次改版产生或引用的纸样图片。' },
    { fieldKey: 'patternFileIds', label: '纸样文件', description: '记录本次改版产生或引用的纸样文件。' },
    { fieldKey: 'liveRetestStatus', label: '回直播验证状态', description: '记录改版样衣是否已回直播验证。' },
  ],
  completionRequiredFields: [
    { fieldKey: 'baseStyleCode', label: '旧款信息', description: '完成前必须明确旧款。' },
    { fieldKey: 'revisionScopeNames', label: '改版范围', description: '完成前必须明确改版范围。' },
    { fieldKey: 'revisionSuggestionRichText', label: '修改建议', description: '完成前必须记录本次改版建议。' },
    { fieldKey: 'generatedNewTechPackVersionFlag', label: '新技术包版本', description: '完成前必须生成新技术包版本。' },
    { fieldKey: 'liveRetestStatus', label: '回直播验证', description: '需要回直播验证时，完成前必须形成验证结果。' },
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
    { fieldKey: 'title', label: '任务标题', description: '在项目节点创建时明确本次制版目标。' },
    { fieldKey: 'patternMakerName', label: '版师', description: '节点推进时必须指定当前版师。' },
    { fieldKey: 'dueAt', label: '截止时间', description: '用于锁定本次制版的计划完成时间。' },
    { fieldKey: 'productHistoryType', label: '产品历史属性', description: '明确该款是未卖过还是已卖过补纸样。' },
    { fieldKey: 'patternArea', label: '打版区域', description: '明确本次打版在印尼或深圳执行。' },
    { fieldKey: 'patternType', label: '版型类型', description: '明确本次制版对应的版型类别。' },
    { fieldKey: 'sizeRange', label: '尺码范围', description: '明确本次制版覆盖的尺码范围。' },
  ],
  detailEditableFields: [
    { fieldKey: 'participantNames', label: '参与人', description: '在实例详情中补齐实际参与制版的人员。' },
    { fieldKey: 'patternVersion', label: '制版版次', description: '在实例详情中补齐最终输出的纸样版次。' },
    { fieldKey: 'materialRequirementLines', label: '面辅料明细', description: '在实例详情中补齐面辅料输入。' },
    { fieldKey: 'colorRequirementText', label: '花色需求', description: '记录本次纸样开发涉及的花色要求。' },
    { fieldKey: 'patternImageLineItems', label: '纸样图片明细', description: '按部位、说明和片数补齐纸样图片。' },
    { fieldKey: 'patternPdfFileIds', label: 'PDF 文件', description: '单独记录 PDF 纸样文件。' },
    { fieldKey: 'patternDxfFileIds', label: 'DXF 文件', description: '单独记录 DXF 纸样文件。' },
    { fieldKey: 'patternRulFileIds', label: 'RUL 文件', description: '单独记录 RUL 纸样文件。' },
    { fieldKey: 'partTemplateLinks', label: '部位模板关联', description: '记录已关联的部位模板和匹配部位。' },
  ],
  completionRequiredFields: [
    { fieldKey: 'patternMakerName', label: '版师', description: '完成前必须明确版师。' },
    { fieldKey: 'productHistoryType', label: '产品历史属性', description: '完成前必须明确产品历史属性。' },
    { fieldKey: 'patternArea', label: '打版区域', description: '完成前必须明确打版区域。' },
    { fieldKey: 'patternDeliverables', label: '纸样资料', description: '完成前必须至少存在纸样图片或 PDF / DXF / RUL 文件。' },
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
    { fieldKey: 'title', label: '任务标题', description: '在项目节点创建时明确本次花型任务主题。' },
    { fieldKey: 'dueAt', label: '截止时间', description: '用于锁定本次花型任务的计划完成时间。' },
    { fieldKey: 'demandSourceType', label: '需求来源', description: '只能来自预售测款通过、改版任务或设计师款。' },
    { fieldKey: 'processType', label: '工艺', description: '数码印、烫画或直喷。' },
    { fieldKey: 'requestQty', label: '数量', description: '文锋填写的花型需求数量。' },
    { fieldKey: 'fabricSku', label: '面料', description: '买手确认的面料编码或名称。' },
    { fieldKey: 'demandImageIds', label: '需求图片', description: '花型划线或需求图片。' },
    { fieldKey: 'assignedTeamCode', label: '团队', description: '中国团队、万隆团队或雅加达团队。' },
    { fieldKey: 'assignedMemberId', label: '花型师', description: '花型师必须来自所选团队。' },
  ],
  detailEditableFields: [
    { fieldKey: 'artworkVersion', label: '花型版次', description: '在实例详情中补齐最终输出的花型版次。' },
    { fieldKey: 'difficultyGrade', label: '难易程度', description: '记录花型执行难度。' },
    { fieldKey: 'colorDepthOption', label: '颜色深浅', description: '参考直播图、图片图和实物说明取中间值。' },
    { fieldKey: 'buyerReviewStatus', label: '买手确认', description: '买手通过后才允许完成。' },
    { fieldKey: 'completionImageIds', label: '完成确认图片', description: '完成前必须上传至少一张确认图。' },
  ],
  completionRequiredFields: [
    { fieldKey: 'artworkVersion', label: '花型版次', description: '完成前必须沉淀本次花型产出的正式版次。' },
    { fieldKey: 'buyerReviewStatus', label: '买手确认通过', description: '完成前必须由买手确认通过。' },
    { fieldKey: 'completionImageIds', label: '完成确认图片', description: '完成前必须有确认图片。' },
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
