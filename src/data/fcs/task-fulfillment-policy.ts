import {
  getMergedProductionTaskDefinition,
  normalizeProductionExecutionProcessCode,
  resolveMergedProductionTaskType,
  type MergedProductionTaskType,
} from './merged-production-task.ts'

export type FulfillmentRuleCode =
  | 'SEWING_ONLY'
  | 'SEWING_TO_IRON_PACK'
  | 'CUTTING_TO_IRON_PACK'
  | 'NO_STAGED_RETURN_RULE'

export type ContractEligibilityCode =
  | 'INDEPENDENT_SEWING'
  | 'SEWING_IRON_PACK'
  | 'CUTTING_SEWING_IRON_PACK'
  | 'NO_PRODUCTION_CONTRACT'

export interface FulfillmentMilestoneRule {
  ratio: 0.3 | 0.7 | 1
  naturalDay: number
}

export interface TaskFulfillmentPolicy {
  taskTypeLabel: string
  normalizedProcessCodes: string[]
  isIndependentTask: boolean
  mergedTaskType: MergedProductionTaskType | null
  /** Whether the task belongs to the three PPIC-managed sewing-outsourcing task types. */
  involvesSewingOutsourcing: boolean
  /** Whether cut pieces are the first handover object, used only for bagging/debt semantics. */
  startsWithSewing: boolean
  assignmentGranularity: 'ORDER' | 'COLOR' | 'SKU' | 'DETAIL'
  fulfillmentRuleCode: FulfillmentRuleCode
  milestones: FulfillmentMilestoneRule[]
  contractEligibilityCode: ContractEligibilityCode
  contractRequired: boolean
  requiresSewingReadinessContext: boolean
}

export interface TaskFulfillmentPolicyInput {
  processCode: string
  processBusinessCode?: string
  processNameZh: string
  taskUnitType?: string
  mergedTaskType?: MergedProductionTaskType
  coveredProcesses?: Array<{
    processCode: string
    processName: string
    sourceArtifactIds?: string[]
  }>
  assignmentGranularity?: 'ORDER' | 'COLOR' | 'SKU' | 'DETAIL'
}

const MILESTONES: Record<Exclude<FulfillmentRuleCode, 'NO_STAGED_RETURN_RULE'>, FulfillmentMilestoneRule[]> = {
  SEWING_ONLY: [
    { ratio: 0.3, naturalDay: 4 },
    { ratio: 0.7, naturalDay: 8 },
    { ratio: 1, naturalDay: 9 },
  ],
  SEWING_TO_IRON_PACK: [
    { ratio: 0.3, naturalDay: 5 },
    { ratio: 0.7, naturalDay: 9 },
    { ratio: 1, naturalDay: 10 },
  ],
  CUTTING_TO_IRON_PACK: [
    { ratio: 0.3, naturalDay: 6 },
    { ratio: 0.7, naturalDay: 9 },
    { ratio: 1, naturalDay: 12 },
  ],
}

function extractIndependentProcessCode(task: TaskFulfillmentPolicyInput): string {
  return normalizeProductionExecutionProcessCode(
    task.processBusinessCode || task.processCode,
    task.processNameZh,
  )
}

function resolveTaskMergedType(task: TaskFulfillmentPolicyInput): MergedProductionTaskType | null {
  if (task.mergedTaskType) return task.mergedTaskType
  if (task.taskUnitType !== 'MERGED_PRODUCTION_TASK') return null
  return resolveMergedProductionTaskType(task.coveredProcesses ?? [])
}

export function classifyTaskFulfillmentPolicy(task: TaskFulfillmentPolicyInput): TaskFulfillmentPolicy {
  const mergedTaskType = resolveTaskMergedType(task)
  if (mergedTaskType) {
    const definition = getMergedProductionTaskDefinition(mergedTaskType)
    const contractEligibilityCode: ContractEligibilityCode = mergedTaskType === 'SEWING_IRON_PACK'
      ? 'SEWING_IRON_PACK'
      : 'CUTTING_SEWING_IRON_PACK'
    return {
      taskTypeLabel: definition.label,
      normalizedProcessCodes: [...definition.requiredSourceProcessCodes],
      isIndependentTask: false,
      mergedTaskType,
      involvesSewingOutsourcing: true,
      startsWithSewing: mergedTaskType === 'SEWING_IRON_PACK',
      assignmentGranularity: definition.assignmentGranularity,
      fulfillmentRuleCode: definition.returnRuleCode,
      milestones: MILESTONES[definition.returnRuleCode].map((item) => ({ ...item })),
      contractEligibilityCode,
      contractRequired: true,
      requiresSewingReadinessContext: true,
    }
  }

  const processCode = extractIndependentProcessCode(task)
  const independentSewing = processCode === 'SEWING'
  const fulfillmentRuleCode: FulfillmentRuleCode = independentSewing ? 'SEWING_ONLY' : 'NO_STAGED_RETURN_RULE'
  const contractEligibilityCode: ContractEligibilityCode = independentSewing
    ? 'INDEPENDENT_SEWING'
    : 'NO_PRODUCTION_CONTRACT'

  return {
    taskTypeLabel: independentSewing ? '独立车缝任务' : '非车缝独立生产任务',
    normalizedProcessCodes: [processCode],
    isIndependentTask: true,
    mergedTaskType: null,
    involvesSewingOutsourcing: independentSewing,
    startsWithSewing: independentSewing,
    assignmentGranularity: independentSewing ? 'SKU' : 'ORDER',
    fulfillmentRuleCode,
    milestones: fulfillmentRuleCode === 'NO_STAGED_RETURN_RULE'
      ? []
      : MILESTONES[fulfillmentRuleCode].map((item) => ({ ...item })),
    contractEligibilityCode,
    contractRequired: independentSewing,
    requiresSewingReadinessContext: independentSewing,
  }
}

export function taskHasProductionContract(task: TaskFulfillmentPolicyInput): boolean {
  return classifyTaskFulfillmentPolicy(task).contractRequired
}

export function taskHasStagedReturnRule(task: TaskFulfillmentPolicyInput): boolean {
  return classifyTaskFulfillmentPolicy(task).fulfillmentRuleCode !== 'NO_STAGED_RETURN_RULE'
}
