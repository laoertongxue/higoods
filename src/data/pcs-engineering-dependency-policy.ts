// 工程主单固定依赖策略：10 类专业任务、11 个生产准备投影节点、固定依赖与自动补齐规则。
// 依赖结构沿用与业务确认的固定规则，不允许人工调整；本模块不提供任何更新接口。

import type {
  EngineeringPreparationType,
  EngineeringTaskStatus,
  EngineeringTaskType,
} from './pcs-engineering-master-types.ts'

export type EngineeringTaskConditionType = 'ALWAYS' | 'PRINT' | 'DYE_YARN' | 'DYE_FABRIC' | 'PURCHASE_ACCESSORY'
export type EngineeringTaskApplicability = 'REQUIRED' | 'CONDITIONAL' | 'NOT_APPLICABLE'

export interface EngineeringBomTaskConditions {
  hasPrintRequirement: boolean
  hasYarnDyeRequirement: boolean
  hasFabricDyeRequirement: boolean
  hasAccessoryPurchaseRequirement: boolean
}

export interface EngineeringTaskPlanLine {
  taskType: EngineeringTaskType
  applicability: EngineeringTaskApplicability
  enabled: boolean
  dependsOn: EngineeringTaskType[]
}

export type EngineeringTaskStageType =
  | 'BOM_REQUIREMENT'
  | 'COLOR_REQUIREMENT_CONFIRMATION'
  | 'FACTORY_COLORING'
  | 'BUYER_REVIEW'

export interface EngineeringTaskStage {
  stageType: EngineeringTaskStageType
  stageName: string
}

export interface EngineeringTaskDefinition {
  taskType: EngineeringTaskType
  taskName: string
  ownerTeamName: string
  dependsOn: EngineeringTaskType[]
  conditionType: EngineeringTaskConditionType
  reviewRequired: boolean
  stages: EngineeringTaskStage[]
}

export type PreparationProjectionCompletionType = 'TASK_SUBMIT' | 'REVIEW_PASS' | 'STAGE_DONE' | 'PURCHASE_BOUND'

export interface PreparationProjectionItem {
  itemType: string
  itemLabel: string
  taskType: EngineeringTaskType
  stageType: EngineeringTaskStageType | ''
  completionType: PreparationProjectionCompletionType
  ownerTeamName: string
}

const ENGINEERING_TASK_DEFINITIONS: EngineeringTaskDefinition[] = [
  {
    taskType: 'BASE_PATTERN_WOVEN',
    taskName: '梭织基码纸样',
    ownerTeamName: '版师',
    dependsOn: [],
    conditionType: 'ALWAYS',
    reviewRequired: false,
    stages: [],
  },
  {
    taskType: 'BASE_PATTERN_KNIT',
    taskName: '毛织基码纸样',
    ownerTeamName: '毛织团队',
    dependsOn: [],
    conditionType: 'ALWAYS',
    reviewRequired: false,
    stages: [],
  },
  {
    taskType: 'PRE_PRODUCTION_SAMPLE',
    taskName: '首单样衣',
    ownerTeamName: '制作团队',
    dependsOn: ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT'],
    conditionType: 'ALWAYS',
    reviewRequired: false,
    stages: [],
  },
  {
    taskType: 'SIZE_PATTERN_WOVEN',
    taskName: '梭织齐码纸样',
    ownerTeamName: '版师',
    dependsOn: ['PRE_PRODUCTION_SAMPLE'],
    conditionType: 'ALWAYS',
    reviewRequired: false,
    stages: [],
  },
  {
    taskType: 'SIZE_PATTERN_KNIT',
    taskName: '毛织齐码纸样',
    ownerTeamName: '毛织团队',
    dependsOn: ['PRE_PRODUCTION_SAMPLE'],
    conditionType: 'ALWAYS',
    reviewRequired: false,
    stages: [],
  },
  {
    taskType: 'PATTERN_ARTWORK',
    taskName: '花型任务',
    ownerTeamName: '花型团队',
    dependsOn: [],
    conditionType: 'PRINT',
    reviewRequired: true,
    stages: [],
  },
  {
    taskType: 'COLOR_YARN',
    taskName: '调色任务（纱线）',
    ownerTeamName: '染厂',
    dependsOn: [],
    conditionType: 'DYE_YARN',
    reviewRequired: true,
    stages: [
      { stageType: 'BOM_REQUIREMENT', stageName: 'BOM 染色物料带入' },
      { stageType: 'COLOR_REQUIREMENT_CONFIRMATION', stageName: '跟单确认染色要求' },
      { stageType: 'FACTORY_COLORING', stageName: '染厂产前调色' },
      { stageType: 'BUYER_REVIEW', stageName: '买手审核调色成果' },
    ],
  },
  {
    taskType: 'COLOR_FABRIC',
    taskName: '调色任务（面料）',
    ownerTeamName: '染厂',
    dependsOn: [],
    conditionType: 'DYE_FABRIC',
    reviewRequired: true,
    stages: [
      { stageType: 'BOM_REQUIREMENT', stageName: 'BOM 染色物料带入' },
      { stageType: 'COLOR_REQUIREMENT_CONFIRMATION', stageName: '跟单确认染色要求' },
      { stageType: 'FACTORY_COLORING', stageName: '染厂产前调色' },
      { stageType: 'BUYER_REVIEW', stageName: '买手审核调色成果' },
    ],
  },
  {
    taskType: 'ACCESSORY_PURCHASE',
    taskName: '辅料下单任务',
    ownerTeamName: '采购人员',
    dependsOn: [],
    conditionType: 'PURCHASE_ACCESSORY',
    reviewRequired: false,
    stages: [],
  },
  {
    taskType: 'TECH_PACK_CONFIRMATION',
    taskName: '技术包确认任务',
    ownerTeamName: '跟单',
    dependsOn: [
      'BASE_PATTERN_WOVEN',
      'BASE_PATTERN_KNIT',
      'PRE_PRODUCTION_SAMPLE',
      'SIZE_PATTERN_WOVEN',
      'SIZE_PATTERN_KNIT',
      'PATTERN_ARTWORK',
      'COLOR_YARN',
      'COLOR_FABRIC',
      'ACCESSORY_PURCHASE',
    ],
    conditionType: 'ALWAYS',
    reviewRequired: false,
    stages: [],
  },
]

const PREPARATION_TASK_APPLICABILITY: Record<
  EngineeringPreparationType,
  Record<EngineeringTaskType, EngineeringTaskApplicability>
> = {
  PURE_WOVEN: {
    BASE_PATTERN_WOVEN: 'REQUIRED',
    BASE_PATTERN_KNIT: 'NOT_APPLICABLE',
    PRE_PRODUCTION_SAMPLE: 'REQUIRED',
    SIZE_PATTERN_WOVEN: 'REQUIRED',
    SIZE_PATTERN_KNIT: 'NOT_APPLICABLE',
    PATTERN_ARTWORK: 'CONDITIONAL',
    COLOR_YARN: 'CONDITIONAL',
    COLOR_FABRIC: 'CONDITIONAL',
    ACCESSORY_PURCHASE: 'CONDITIONAL',
    TECH_PACK_CONFIRMATION: 'REQUIRED',
  },
  HEAT_TRANSFER_DIRECT_PRINT: {
    BASE_PATTERN_WOVEN: 'NOT_APPLICABLE',
    BASE_PATTERN_KNIT: 'NOT_APPLICABLE',
    PRE_PRODUCTION_SAMPLE: 'NOT_APPLICABLE',
    SIZE_PATTERN_WOVEN: 'NOT_APPLICABLE',
    SIZE_PATTERN_KNIT: 'NOT_APPLICABLE',
    PATTERN_ARTWORK: 'REQUIRED',
    COLOR_YARN: 'CONDITIONAL',
    COLOR_FABRIC: 'CONDITIONAL',
    ACCESSORY_PURCHASE: 'CONDITIONAL',
    TECH_PACK_CONFIRMATION: 'REQUIRED',
  },
  KNIT: {
    BASE_PATTERN_WOVEN: 'NOT_APPLICABLE',
    BASE_PATTERN_KNIT: 'REQUIRED',
    PRE_PRODUCTION_SAMPLE: 'REQUIRED',
    SIZE_PATTERN_WOVEN: 'NOT_APPLICABLE',
    SIZE_PATTERN_KNIT: 'REQUIRED',
    PATTERN_ARTWORK: 'CONDITIONAL',
    COLOR_YARN: 'CONDITIONAL',
    COLOR_FABRIC: 'CONDITIONAL',
    ACCESSORY_PURCHASE: 'CONDITIONAL',
    TECH_PACK_CONFIRMATION: 'REQUIRED',
  },
  KNIT_WOVEN: {
    BASE_PATTERN_WOVEN: 'REQUIRED',
    BASE_PATTERN_KNIT: 'REQUIRED',
    PRE_PRODUCTION_SAMPLE: 'REQUIRED',
    SIZE_PATTERN_WOVEN: 'REQUIRED',
    SIZE_PATTERN_KNIT: 'REQUIRED',
    PATTERN_ARTWORK: 'CONDITIONAL',
    COLOR_YARN: 'CONDITIONAL',
    COLOR_FABRIC: 'CONDITIONAL',
    ACCESSORY_PURCHASE: 'CONDITIONAL',
    TECH_PACK_CONFIRMATION: 'REQUIRED',
  },
}

const EMPTY_BOM_CONDITIONS: EngineeringBomTaskConditions = {
  hasPrintRequirement: false,
  hasYarnDyeRequirement: false,
  hasFabricDyeRequirement: false,
  hasAccessoryPurchaseRequirement: false,
}

export const ENGINEERING_PREPARATION_TYPES: readonly EngineeringPreparationType[] = [
  'PURE_WOVEN',
  'HEAT_TRANSFER_DIRECT_PRINT',
  'KNIT',
  'KNIT_WOVEN',
]

export function isEngineeringPreparationType(value: unknown): value is EngineeringPreparationType {
  return ENGINEERING_PREPARATION_TYPES.includes(value as EngineeringPreparationType)
}

export function getEngineeringTaskApplicability(
  preparationType: EngineeringPreparationType,
  taskType: EngineeringTaskType,
): EngineeringTaskApplicability {
  return PREPARATION_TASK_APPLICABILITY[preparationType][taskType]
}

function conditionSatisfied(
  taskType: EngineeringTaskType,
  conditions: EngineeringBomTaskConditions,
): boolean {
  if (taskType === 'PATTERN_ARTWORK') return conditions.hasPrintRequirement
  if (taskType === 'COLOR_YARN') return conditions.hasYarnDyeRequirement
  if (taskType === 'COLOR_FABRIC') return conditions.hasFabricDyeRequirement
  if (taskType === 'ACCESSORY_PURCHASE') return conditions.hasAccessoryPurchaseRequirement
  return true
}

export function getEngineeringTaskDependencies(
  preparationType: EngineeringPreparationType,
  taskType: EngineeringTaskType,
  enabledTaskTypes: readonly EngineeringTaskType[] = [],
): EngineeringTaskType[] {
  if (taskType === 'PRE_PRODUCTION_SAMPLE') {
    if (preparationType === 'PURE_WOVEN') return ['BASE_PATTERN_WOVEN']
    if (preparationType === 'KNIT') return ['BASE_PATTERN_KNIT']
    if (preparationType === 'KNIT_WOVEN') return ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT']
    return []
  }
  if (taskType === 'SIZE_PATTERN_WOVEN' || taskType === 'SIZE_PATTERN_KNIT') {
    return ['PRE_PRODUCTION_SAMPLE']
  }
  if (taskType === 'TECH_PACK_CONFIRMATION') {
    return enabledTaskTypes.filter((candidate) => candidate !== 'TECH_PACK_CONFIRMATION')
  }
  return []
}

export function buildEngineeringTaskPlan(
  preparationType: EngineeringPreparationType,
  conditions: EngineeringBomTaskConditions = EMPTY_BOM_CONDITIONS,
  selectedConditionalTaskTypes: readonly EngineeringTaskType[] = [],
): EngineeringTaskPlanLine[] {
  const selected = new Set(selectedConditionalTaskTypes)
  const enabledTaskTypes = ENGINEERING_TASK_DEFINITIONS
    .map((definition) => definition.taskType)
    .filter((taskType) => {
      const applicability = getEngineeringTaskApplicability(preparationType, taskType)
      if (applicability === 'REQUIRED') return true
      if (applicability === 'NOT_APPLICABLE') return false
      return conditionSatisfied(taskType, conditions) || selected.has(taskType)
    })
  return ENGINEERING_TASK_DEFINITIONS.map((definition) => {
    const applicability = getEngineeringTaskApplicability(preparationType, definition.taskType)
    return {
      taskType: definition.taskType,
      applicability,
      enabled: enabledTaskTypes.includes(definition.taskType),
      dependsOn: getEngineeringTaskDependencies(preparationType, definition.taskType, enabledTaskTypes),
    }
  })
}

const PREPARATION_PROJECTION_ITEMS: PreparationProjectionItem[] = [
  { itemType: '梭织基码纸样', itemLabel: '梭织基码纸样', taskType: 'BASE_PATTERN_WOVEN', stageType: '', completionType: 'TASK_SUBMIT', ownerTeamName: '版师' },
  { itemType: '毛织基码纸样', itemLabel: '毛织基码纸样', taskType: 'BASE_PATTERN_KNIT', stageType: '', completionType: 'TASK_SUBMIT', ownerTeamName: '毛织团队' },
  { itemType: '版衣制作', itemLabel: '版衣制作', taskType: 'PRE_PRODUCTION_SAMPLE', stageType: '', completionType: 'TASK_SUBMIT', ownerTeamName: '制作团队' },
  { itemType: '梭织齐码纸样', itemLabel: '梭织齐码纸样', taskType: 'SIZE_PATTERN_WOVEN', stageType: '', completionType: 'TASK_SUBMIT', ownerTeamName: '版师' },
  { itemType: '毛织齐码纸样', itemLabel: '毛织齐码纸样', taskType: 'SIZE_PATTERN_KNIT', stageType: '', completionType: 'TASK_SUBMIT', ownerTeamName: '毛织团队' },
  { itemType: '数码印/DTF/DTG花型', itemLabel: '数码印/DTF/DTG 花型', taskType: 'PATTERN_ARTWORK', stageType: '', completionType: 'REVIEW_PASS', ownerTeamName: '买手' },
  { itemType: '确认染色要求（纱线）', itemLabel: '确认染色要求（纱线）', taskType: 'COLOR_YARN', stageType: 'COLOR_REQUIREMENT_CONFIRMATION', completionType: 'STAGE_DONE', ownerTeamName: '跟单' },
  { itemType: '染色调色（纱线）', itemLabel: '染色调色（纱线）', taskType: 'COLOR_YARN', stageType: 'BUYER_REVIEW', completionType: 'STAGE_DONE', ownerTeamName: '买手' },
  { itemType: '确认染色要求（面料）', itemLabel: '确认染色要求（面料）', taskType: 'COLOR_FABRIC', stageType: 'COLOR_REQUIREMENT_CONFIRMATION', completionType: 'STAGE_DONE', ownerTeamName: '跟单' },
  { itemType: '染色调色（面料）', itemLabel: '染色调色（面料）', taskType: 'COLOR_FABRIC', stageType: 'BUYER_REVIEW', completionType: 'STAGE_DONE', ownerTeamName: '买手' },
  { itemType: '辅料下单', itemLabel: '辅料下单', taskType: 'ACCESSORY_PURCHASE', stageType: '', completionType: 'PURCHASE_BOUND', ownerTeamName: '采购人员' },
]

export function listEngineeringTaskDefinitions(): EngineeringTaskDefinition[] {
  return ENGINEERING_TASK_DEFINITIONS.map((definition) => ({
    ...definition,
    dependsOn: [...definition.dependsOn],
    stages: definition.stages.map((stage) => ({ ...stage })),
  }))
}

export function getEngineeringTaskDefinition(taskType: EngineeringTaskType): EngineeringTaskDefinition {
  const definition = ENGINEERING_TASK_DEFINITIONS.find((item) => item.taskType === taskType)
  if (!definition) throw new Error(`未知工程任务类型：${taskType}`)
  return {
    ...definition,
    dependsOn: [...definition.dependsOn],
    stages: definition.stages.map((stage) => ({ ...stage })),
  }
}

export function listPreparationProjectionItems(): PreparationProjectionItem[] {
  return PREPARATION_PROJECTION_ITEMS.map((item) => ({ ...item }))
}

// 选择后续任务时自动补齐缺失前置任务，不允许产生缺前置任务。
export function buildDependencyClosure(selectedTaskTypes: EngineeringTaskType[]): EngineeringTaskType[] {
  const closure = new Set<EngineeringTaskType>()
  const visit = (taskType: EngineeringTaskType): void => {
    if (closure.has(taskType)) return
    closure.add(taskType)
    const definition = getEngineeringTaskDefinition(taskType)
    for (const dependency of definition.dependsOn) visit(dependency)
  }
  for (const taskType of selectedTaskTypes) visit(taskType)
  return [...closure]
}

export function buildPreparationDependencyClosure(
  preparationType: EngineeringPreparationType,
  selectedTaskTypes: EngineeringTaskType[],
): EngineeringTaskType[] {
  const closure = new Set<EngineeringTaskType>()
  const visit = (taskType: EngineeringTaskType): void => {
    if (closure.has(taskType)) return
    if (getEngineeringTaskApplicability(preparationType, taskType) === 'NOT_APPLICABLE') {
      throw new Error('所选任务不适用于当前生产准备类型。')
    }
    closure.add(taskType)
    for (const dependency of getEngineeringTaskDependencies(preparationType, taskType)) visit(dependency)
  }
  selectedTaskTypes.forEach(visit)
  return [...closure]
}

// 初始状态派生：条件任务未启用；有前置待前置；无前置待开始。
export function resolveInitialTaskStatus(taskType: EngineeringTaskType): EngineeringTaskStatus {
  const definition = getEngineeringTaskDefinition(taskType)
  if (definition.conditionType !== 'ALWAYS') return '未启用'
  if (definition.dependsOn.length > 0) return '待前置'
  return '待开始'
}

// 提交目标状态派生：制版与首单样衣提交成果即完成；只有花型和调色进入待审核。
export function resolveEngineeringTaskSubmitStatus(taskType: EngineeringTaskType): EngineeringTaskStatus {
  const definition = getEngineeringTaskDefinition(taskType)
  return definition.reviewRequired ? '待审核' : '已完成'
}
