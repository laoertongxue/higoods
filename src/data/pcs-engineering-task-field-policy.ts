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
    { fieldKey: 'issueSummary', label: '问题点', description: '记录本次改版要解决的核心问题。' },
    { fieldKey: 'evidenceSummary', label: '证据说明', description: '记录支撑改版的评审、反馈和比对证据。' },
  ],
  detailEditableFields: [
    { fieldKey: 'participantNames', label: '参与人', description: '在实例详情中补齐实际参与执行的人员。' },
    { fieldKey: 'revisionVersion', label: '改版版次', description: '在实例详情中补齐本次改版产出的版次标记。' },
  ],
  completionRequiredFields: [
    { fieldKey: 'participantNames', label: '参与人', description: '完成前必须能明确谁参与了本次改版。' },
    { fieldKey: 'revisionVersion', label: '改版版次', description: '完成前必须沉淀本次改版的正式版次。' },
  ],
  nodeWritebacks: [
    {
      phase: '创建后',
      resultType: '已创建改版任务',
      resultText: '已创建改版任务，待在实例详情补齐执行信息。',
      pendingActionType: '补齐改版信息',
      pendingActionText: '请在改版任务详情补齐参与人和改版版次，并推进执行。',
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
    { fieldKey: 'ownerName', label: '负责人', description: '节点推进时必须指定当前制版负责人。' },
    { fieldKey: 'dueAt', label: '截止时间', description: '用于锁定本次制版的计划完成时间。' },
    { fieldKey: 'patternType', label: '版型类型', description: '明确本次制版对应的版型类别。' },
    { fieldKey: 'sizeRange', label: '尺码范围', description: '明确本次制版覆盖的尺码范围。' },
  ],
  detailEditableFields: [
    { fieldKey: 'participantNames', label: '参与人', description: '在实例详情中补齐实际参与制版的人员。' },
    { fieldKey: 'patternVersion', label: '制版版次', description: '在实例详情中补齐最终输出的纸样版次。' },
  ],
  completionRequiredFields: [
    { fieldKey: 'participantNames', label: '参与人', description: '完成前必须沉淀本次制版的参与人员。' },
    { fieldKey: 'patternVersion', label: '制版版次', description: '完成前必须沉淀本次制版产出的正式版次。' },
  ],
  nodeWritebacks: [
    {
      phase: '创建后',
      resultType: '已创建制版任务',
      resultText: '已创建制版任务，待在实例详情补齐版次信息。',
      pendingActionType: '输出纸样版本',
      pendingActionText: '请在制版任务详情补齐参与人和制版版次，并输出纸样版本。',
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
    { fieldKey: 'ownerName', label: '负责人', description: '节点推进时必须指定当前花型负责人。' },
    { fieldKey: 'dueAt', label: '截止时间', description: '用于锁定本次花型任务的计划完成时间。' },
    { fieldKey: 'artworkType', label: '花型类型', description: '明确本次任务属于印花、贴章、绣花等类型。' },
    { fieldKey: 'patternMode', label: '图案方式', description: '明确本次任务属于定位印、满印或局部图案。' },
    { fieldKey: 'artworkName', label: '花型名称', description: '沉淀本次花型任务的正式名称。' },
  ],
  detailEditableFields: [
    { fieldKey: 'artworkVersion', label: '花型版次', description: '在实例详情中补齐最终输出的花型版次。' },
  ],
  completionRequiredFields: [
    { fieldKey: 'artworkVersion', label: '花型版次', description: '完成前必须沉淀本次花型产出的正式版次。' },
  ],
  nodeWritebacks: [
    {
      phase: '创建后',
      resultType: '已创建花型任务',
      resultText: '已创建花型任务，待在实例详情补齐花型版次。',
      pendingActionType: '输出花型版本',
      pendingActionText: '请在花型任务详情补齐花型版次，并输出正式花型版本。',
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
  if (task.participantNames.length === 0) missing.push('参与人')
  if (!task.revisionVersion.trim()) missing.push('改版版次')
  return missing
}

export function getPlateTaskCompletionMissingFields(task: PlateMakingTaskRecord): string[] {
  const missing: string[] = []
  if (task.participantNames.length === 0) missing.push('参与人')
  if (!task.patternVersion.trim()) missing.push('制版版次')
  return missing
}

export function getPatternTaskCompletionMissingFields(task: PatternTaskRecord): string[] {
  const missing: string[] = []
  if (!task.artworkVersion.trim()) missing.push('花型版次')
  return missing
}
