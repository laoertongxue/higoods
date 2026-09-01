export type MergedProductionTaskType =
  | 'SEWING_IRON_PACK'
  | 'CUTTING_SEWING_IRON_PACK'

export type AuxiliarySpecialExecutorMode =
  | 'CENTRAL_FACTORY'
  | 'FOLLOW_MERGED_TASK_FACTORY'

export interface MergedProductionTaskDefinition {
  type: MergedProductionTaskType
  label: string
  requiredSourceProcessCodes: readonly string[]
  responsibilityLabel: string
  assignmentGranularity: 'ORDER' | 'SKU'
  auxiliarySpecialExecutorMode: AuxiliarySpecialExecutorMode
  generatesCentralAuxiliarySpecialOrders: boolean
  returnRuleCode: 'SEWING_TO_IRON_PACK' | 'CUTTING_TO_IRON_PACK'
}

export const MERGED_PRODUCTION_TASK_DEFINITIONS: Record<MergedProductionTaskType, MergedProductionTaskDefinition> = {
  SEWING_IRON_PACK: {
    type: 'SEWING_IRON_PACK',
    label: '车缝+烫包',
    requiredSourceProcessCodes: ['SEWING', 'IRON_PACK'],
    responsibilityLabel: '车缝至烫包；按冻结技术包一并完成开扣眼、装扣子',
    assignmentGranularity: 'ORDER',
    auxiliarySpecialExecutorMode: 'CENTRAL_FACTORY',
    generatesCentralAuxiliarySpecialOrders: true,
    returnRuleCode: 'SEWING_TO_IRON_PACK',
  },
  CUTTING_SEWING_IRON_PACK: {
    type: 'CUTTING_SEWING_IRON_PACK',
    label: '裁剪+车缝+烫包',
    requiredSourceProcessCodes: ['CUTTING', 'SEWING', 'IRON_PACK'],
    responsibilityLabel: '裁剪、车缝至烫包；按冻结技术包一并完成辅助工艺、特种工艺、开扣眼和装扣子',
    assignmentGranularity: 'ORDER',
    auxiliarySpecialExecutorMode: 'FOLLOW_MERGED_TASK_FACTORY',
    generatesCentralAuxiliarySpecialOrders: false,
    returnRuleCode: 'CUTTING_TO_IRON_PACK',
  },
}

const PROCESS_CODE_ALIASES: Record<string, string> = {
  CUT: 'CUTTING',
  CUT_PANEL: 'CUTTING',
  CUTTING: 'CUTTING',
  SEW: 'SEWING',
  SEWING: 'SEWING',
  IRON_PACK: 'IRON_PACK',
  BUTTONHOLE: 'BUTTONHOLE',
  BUTTON_ATTACH: 'BUTTON_ATTACH',
}

const PROCESS_NAME_ALIASES: Record<string, string> = {
  '裁片': 'CUTTING',
  '裁剪': 'CUTTING',
  '车缝': 'SEWING',
  '烫包': 'IRON_PACK',
  '开扣眼': 'BUTTONHOLE',
  '装扣子': 'BUTTON_ATTACH',
}

export function normalizeProductionExecutionProcessCode(code?: string, name?: string): string {
  const normalizedCode = String(code ?? '').trim().toUpperCase()
  const normalizedName = String(name ?? '').trim()
  return PROCESS_CODE_ALIASES[normalizedCode]
    || PROCESS_NAME_ALIASES[normalizedName]
    || normalizedCode
    || normalizedName
    || 'UNKNOWN'
}

export function resolveMergedProductionTaskType(
  processes: Array<{ processCode?: string; processBusinessCode?: string; processNameZh?: string; processName?: string }>,
): MergedProductionTaskType | null {
  const normalized = Array.from(new Set(processes.map((item) => normalizeProductionExecutionProcessCode(
    item.processBusinessCode || item.processCode,
    item.processNameZh || item.processName,
  )))).sort()

  for (const definition of Object.values(MERGED_PRODUCTION_TASK_DEFINITIONS)) {
    const expected = [...definition.requiredSourceProcessCodes].sort()
    if (normalized.length === expected.length && normalized.every((code, index) => code === expected[index])) {
      return definition.type
    }
  }
  return null
}

export interface ProductionExecutionTaskBoundaryInput {
  stageCode?: string
  defaultDocType?: string
  executionEnabled?: boolean
  taskUnitType?: string
  mergedIntoTaskId?: string
  processCode?: string
  processBusinessCode?: string
  processNameZh?: string
}

export function isAssignableProductionExecutionTask(task: ProductionExecutionTaskBoundaryInput): boolean {
  if (task.executionEnabled === false) return false
  if (task.defaultDocType && task.defaultDocType !== 'TASK') return false
  if (task.stageCode === 'PREP') return false
  if (task.mergedIntoTaskId) return false
  if (task.taskUnitType === 'WHOLE_ORDER_TASK' || task.taskUnitType === 'MERGED_PRODUCTION_TASK') return true
  const processCode = normalizeProductionExecutionProcessCode(
    task.processBusinessCode || task.processCode,
    task.processNameZh,
  )
  // 开扣眼、装扣子是后道阶段内部工序，只随固定合并任务责任范围执行，不能单独进入任务清单或分配。
  if (processCode === 'BUTTONHOLE' || processCode === 'BUTTON_ATTACH') return false
  return task.stageCode === 'PROD' || (task.stageCode === 'POST' && processCode === 'IRON_PACK')
}

export function getMergedProductionTaskDefinition(type: MergedProductionTaskType): MergedProductionTaskDefinition {
  return MERGED_PRODUCTION_TASK_DEFINITIONS[type]
}
