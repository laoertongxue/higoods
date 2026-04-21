import {
  getFactorySupplyFormulaGuide,
  getFactorySupplyFormulaGuideByTemplate,
  getFactorySupplyFormulaTemplate,
  type FactorySupplyFormulaTemplate,
} from './process-craft-sam-explainer.ts'

export type ProcessAssignmentGranularity = 'ORDER' | 'COLOR' | 'SKU' | 'DETAIL'
export type CraftStageCode = 'PREP' | 'PROD' | 'POST'
export type ProcessDocType = 'DEMAND' | 'TASK'
export type TaskTypeMode = 'PROCESS' | 'CRAFT'
export type ProcessRole = 'EXTERNAL_TASK' | 'INTERNAL_CAPACITY_NODE'
export type CapacityRollupMode = 'SELF' | 'CHILD_NODES' | 'NONE'
export type FactoryMobileExecutionMode = 'FULL_TASK' | 'INTERNAL_RECORD_ONLY' | 'NONE'
export type DetailSplitMode = 'COMPOSITE'
export type DetailSplitDimension = 'PATTERN' | 'MATERIAL_SKU' | 'GARMENT_COLOR' | 'GARMENT_SKU'
export type RuleSource = 'INHERIT_PROCESS' | 'OVERRIDE_CRAFT'
export type SamCalcMode = 'DISCRETE' | 'CONTINUOUS' | 'BATCH'
export type SamInputUnit = 'PIECE' | 'METER' | 'KG' | 'BATCH'
export type PublishedSamUnit =
  | 'MINUTE_PER_PIECE'
  | 'MINUTE_PER_BATCH'
  | 'MINUTE_PER_METER'
  | 'MINUTE_PER_DOZEN'
export type CapacityConstraintSource = 'DEVICE' | 'STAFF' | 'BOTH'
export type SamFactoryFieldGroup = 'DEVICE' | 'STAFF' | 'ADJUSTMENT'
export type SamFactoryFieldKey =
  | 'deviceCount'
  | 'deviceShiftMinutes'
  | 'deviceEfficiencyValue'
  | 'deviceEfficiencyUnit'
  | 'staffCount'
  | 'staffShiftMinutes'
  | 'staffEfficiencyValue'
  | 'staffEfficiencyUnit'
  | 'batchLoadCapacity'
  | 'batchLoadUnit'
  | 'cycleMinutes'
  | 'setupMinutes'
  | 'switchMinutes'
  | 'efficiencyFactor'

export type SamCurrentFieldKey = Exclude<
  SamFactoryFieldKey,
  'deviceEfficiencyUnit' | 'staffEfficiencyUnit' | 'batchLoadUnit'
>

export interface SamFactoryFieldDefinition {
  key: SamFactoryFieldKey
  label: string
  group: SamFactoryFieldGroup
  description: string
}

export interface ProcessStageDefinition {
  stageCode: CraftStageCode
  stageName: string
  sort: number
  description: string
}

export interface ProcessDefinition {
  processCode: string
  systemProcessCode: string
  processName: string
  stageCode: CraftStageCode
  sort: number
  processRole: ProcessRole
  parentProcessCode?: string
  generatesExternalTask: boolean
  requiresTaskQr: boolean
  requiresHandoverOrder: boolean
  capacityEnabled: boolean
  capacityRollupMode: CapacityRollupMode
  factoryMobileExecutionMode: FactoryMobileExecutionMode
  isActive: boolean
  assignmentGranularity: ProcessAssignmentGranularity
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  detailSplitMode: DetailSplitMode
  detailSplitDimensions: DetailSplitDimension[]
  isSpecialCraftContainer: boolean
  description?: string
  triggerSource?: string
  defaultDocLabel: string
  samEnabled: boolean
  samCalcMode: SamCalcMode
  samDefaultInputUnit: SamInputUnit
  samConstraintSource: CapacityConstraintSource
  samIdealFieldKeys: SamFactoryFieldKey[]
  samIdealReason: string
  samCurrentFieldKeys: SamCurrentFieldKey[]
  samCurrentFormulaLines: string[]
  samCurrentExplanationLines: string[]
  samCurrentExampleLines: string[]
  samCurrentReason: string
  samFactoryFieldKeys: SamFactoryFieldKey[]
  samReason: string
}

export interface ProcessCraftDefinition {
  craftCode: string
  craftName: string
  legacyValue: number
  legacyCraftName: string
  processCode: string
  systemProcessCode: string
  stageCode: CraftStageCode
  processRole: ProcessRole
  parentProcessCode?: string
  generatesExternalTask: boolean
  requiresTaskQr: boolean
  requiresHandoverOrder: boolean
  capacityEnabled: boolean
  capacityRollupMode: CapacityRollupMode
  factoryMobileExecutionMode: FactoryMobileExecutionMode
  isActive: boolean
  assignmentGranularity: ProcessAssignmentGranularity
  ruleSource: RuleSource
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  detailSplitMode: DetailSplitMode
  detailSplitDimensions: DetailSplitDimension[]
  isSpecialCraft: boolean
  referencePublishedSamValue: number
  referencePublishedSamUnit: PublishedSamUnit
  referencePublishedSamNote: string
  carrySuggestion: string
  remark?: string
  samEnabled: boolean
  samCalcMode?: SamCalcMode
  samDefaultInputUnit?: SamInputUnit
  samConstraintSource?: CapacityConstraintSource
  samIdealFieldKeys?: SamFactoryFieldKey[]
  samIdealReason?: string
  samCurrentFieldKeys?: SamCurrentFieldKey[]
  samCurrentFormulaLines?: string[]
  samCurrentExplanationLines?: string[]
  samCurrentExampleLines?: string[]
  samCurrentReason?: string
  samFactoryFieldKeys?: SamFactoryFieldKey[]
  samReason?: string
}

export interface LegacyCraftMappingDefinition {
  legacyValue: number
  legacyCraftName: string
  craftName: string
  processCode: string
  isSpecialCraft: boolean
  isActive?: boolean
  defaultDocument: string
  ruleSource?: RuleSource
  assignmentGranularity?: ProcessAssignmentGranularity
  detailSplitMode?: DetailSplitMode
  detailSplitDimensions?: DetailSplitDimension[]
  remark?: string
}

export type ProcessCraftDictRow = {
  craftCode: string
  craftName: string
  processCode: string
  processName: string
  stageCode: CraftStageCode
  stageName: string
  isActive: boolean
  statusLabel: string
  processRole: ProcessRole
  processRoleLabel: string
  taskScopeLabel: string
  parentProcessCode?: string
  parentProcessName?: string
  generatesExternalTask: boolean
  generatesExternalTaskLabel: string
  requiresTaskQr: boolean
  requiresTaskQrLabel: string
  requiresHandoverOrder: boolean
  requiresHandoverOrderLabel: string
  capacityEnabled: boolean
  capacityEnabledLabel: string
  capacityRollupMode: CapacityRollupMode
  factoryMobileExecutionMode: FactoryMobileExecutionMode
  assignmentGranularity: ProcessAssignmentGranularity
  assignmentGranularityLabel: string
  ruleSource: RuleSource
  ruleSourceLabel: string
  detailSplitMode: DetailSplitMode
  detailSplitModeLabel: string
  detailSplitDimensions: DetailSplitDimension[]
  detailSplitDimensionsText: string
  handoffAdvice: string
  legacyValue: number
  legacyCraftName: string
  isSpecialCraft: boolean
  defaultDocument: string
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  referencePublishedSamValue: number
  referencePublishedSamUnit: PublishedSamUnit
  referencePublishedSamUnitLabel: string
  referencePublishedSamNote: string
  processAssignmentGranularity: ProcessAssignmentGranularity
  processAssignmentGranularityLabel: string
  processDetailSplitMode: DetailSplitMode
  processDetailSplitModeLabel: string
  processDetailSplitDimensions: DetailSplitDimension[]
  processDetailSplitDimensionsText: string
  remark?: string
  processNote?: string
  triggerSource?: string
  samEnabled: boolean
  samCalcMode: SamCalcMode
  samCalcModeLabel: string
  samDefaultInputUnit: SamInputUnit
  samDefaultInputUnitLabel: string
  samConstraintSource: CapacityConstraintSource
  samConstraintSourceLabel: string
  samIdealFieldKeys: SamFactoryFieldKey[]
  samIdealFieldText: string
  samIdealReason: string
  samCurrentFieldKeys: SamCurrentFieldKey[]
  samCurrentFieldText: string
  samCurrentFormulaLines: string[]
  samCurrentExplanationLines: string[]
  samCurrentExampleLines: string[]
  samCurrentReason: string
  samFactoryFieldKeys: SamFactoryFieldKey[]
  samFactoryFieldText: string
  samReason: string
}

export const PROCESS_ASSIGNMENT_GRANULARITY_LABEL: Record<ProcessAssignmentGranularity, string> = {
  ORDER: '按生产单',
  COLOR: '按颜色',
  SKU: '按SKU',
  DETAIL: '按明细行',
}

export const PROCESS_ROLE_LABEL: Record<ProcessRole, string> = {
  EXTERNAL_TASK: '对外任务',
  INTERNAL_CAPACITY_NODE: '产能节点',
}

export const DETAIL_SPLIT_MODE_LABEL: Record<DetailSplitMode, string> = {
  COMPOSITE: '组合维度',
}

export const DETAIL_SPLIT_DIMENSION_LABEL: Record<DetailSplitDimension, string> = {
  PATTERN: '纸样',
  MATERIAL_SKU: '物料SKU',
  GARMENT_COLOR: '成衣颜色',
  GARMENT_SKU: '成衣SKU',
}

export const RULE_SOURCE_LABEL: Record<RuleSource, string> = {
  INHERIT_PROCESS: '继承工序规则',
  OVERRIDE_CRAFT: '工艺覆盖规则',
}

export const PROCESS_DOC_TYPE_LABEL: Record<ProcessDocType, string> = {
  DEMAND: '需求单',
  TASK: '任务单',
}

function toYesNoLabel(value: boolean): string {
  return value ? '是' : '否'
}

function toStatusLabel(isActive: boolean): string {
  return isActive ? '可用' : '历史停用'
}

export const TASK_TYPE_MODE_LABEL: Record<TaskTypeMode, string> = {
  PROCESS: '按工序',
  CRAFT: '按工艺',
}

export const SAM_CALC_MODE_LABEL: Record<SamCalcMode, string> = {
  DISCRETE: '离散型',
  CONTINUOUS: '连续型',
  BATCH: '批次型',
}

export const SAM_INPUT_UNIT_LABEL: Record<SamInputUnit, string> = {
  PIECE: '按件录入',
  METER: '按米录入',
  KG: '按公斤录入',
  BATCH: '按批次录入',
}

export const PUBLISHED_SAM_UNIT_LABEL: Record<PublishedSamUnit, string> = {
  MINUTE_PER_PIECE: '分钟/件',
  MINUTE_PER_BATCH: '分钟/批',
  MINUTE_PER_METER: '分钟/米',
  MINUTE_PER_DOZEN: '分钟/打',
}

export const CAPACITY_CONSTRAINT_SOURCE_LABEL: Record<CapacityConstraintSource, string> = {
  DEVICE: '设备约束',
  STAFF: '人员约束',
  BOTH: '设备+人员共同约束',
}

export const SAM_FACTORY_FIELD_GROUP_LABEL: Record<SamFactoryFieldGroup, string> = {
  DEVICE: '设备',
  STAFF: '人员',
  ADJUSTMENT: '调整',
}

export const SAM_FACTORY_FIELD_ORDER: SamFactoryFieldKey[] = [
  'deviceCount',
  'deviceShiftMinutes',
  'batchLoadCapacity',
  'batchLoadUnit',
  'cycleMinutes',
  'deviceEfficiencyValue',
  'deviceEfficiencyUnit',
  'staffCount',
  'staffShiftMinutes',
  'staffEfficiencyValue',
  'staffEfficiencyUnit',
  'setupMinutes',
  'switchMinutes',
  'efficiencyFactor',
]

export const SAM_FACTORY_FIELD_DICT: Record<SamFactoryFieldKey, SamFactoryFieldDefinition> = {
  deviceCount: {
    key: 'deviceCount',
    label: '设备数量',
    group: 'DEVICE',
    description: '用于记录该工序/工艺可投入的有效设备台数，是设备供给能力的基础。',
  },
  deviceShiftMinutes: {
    key: 'deviceShiftMinutes',
    label: '单台单班有效分钟',
    group: 'DEVICE',
    description: '用于记录单台设备每班真正可用于生产的分钟数，排除停机与不可用时段。',
  },
  deviceEfficiencyValue: {
    key: 'deviceEfficiencyValue',
    label: '设备标准效率值',
    group: 'DEVICE',
    description: '用于记录设备标准产出速度数值，例如件/小时、米/分钟等。',
  },
  deviceEfficiencyUnit: {
    key: 'deviceEfficiencyUnit',
    label: '设备效率单位',
    group: 'DEVICE',
    description: '用于说明设备标准效率值的单位口径，确保后续换算一致。',
  },
  staffCount: {
    key: 'staffCount',
    label: '人数',
    group: 'STAFF',
    description: '用于记录该工序/工艺可投入的标准人数，是人员供给能力的基础。',
  },
  staffShiftMinutes: {
    key: 'staffShiftMinutes',
    label: '单人单班有效分钟',
    group: 'STAFF',
    description: '用于记录单人单班实际可用于生产的有效分钟数。',
  },
  staffEfficiencyValue: {
    key: 'staffEfficiencyValue',
    label: '人员标准效率值',
    group: 'STAFF',
    description: '用于记录人员在标准状态下的单位时间产出速度数值。',
  },
  staffEfficiencyUnit: {
    key: 'staffEfficiencyUnit',
    label: '人员效率单位',
    group: 'STAFF',
    description: '用于说明人员标准效率值的单位口径，确保不同工艺之间可正确解释。',
  },
  batchLoadCapacity: {
    key: 'batchLoadCapacity',
    label: '单次有效装载量',
    group: 'ADJUSTMENT',
    description: '用于记录批次型工序单次可处理的有效装载量，是批次能力计算的核心参数。',
  },
  batchLoadUnit: {
    key: 'batchLoadUnit',
    label: '装载量单位',
    group: 'ADJUSTMENT',
    description: '用于说明单次有效装载量的单位，例如公斤/批、卷/批。',
  },
  cycleMinutes: {
    key: 'cycleMinutes',
    label: '单次循环分钟',
    group: 'ADJUSTMENT',
    description: '用于记录批次型工序从开始到完成一个循环所需的分钟数。',
  },
  setupMinutes: {
    key: 'setupMinutes',
    label: '固定准备分钟',
    group: 'ADJUSTMENT',
    description: '用于记录开机、开版、上料等固定准备时间，避免把准备损耗漏掉。',
  },
  switchMinutes: {
    key: 'switchMinutes',
    label: '切换准备分钟',
    group: 'ADJUSTMENT',
    description: '用于记录换色、换版、换模具、换物料时的切换准备时间。',
  },
  efficiencyFactor: {
    key: 'efficiencyFactor',
    label: '工厂效率系数',
    group: 'ADJUSTMENT',
    description: '用于修正理论产出与工厂实际供给能力之间的偏差。',
  },
}

type ProcessSamRule = {
  samEnabled: boolean
  samCalcMode: SamCalcMode
  samDefaultInputUnit: SamInputUnit
  samConstraintSource: CapacityConstraintSource
  samIdealFieldKeys: SamFactoryFieldKey[]
  samIdealReason: string
}

type CraftSamRuleOverride = Partial<Pick<ProcessSamRule, 'samCalcMode' | 'samDefaultInputUnit' | 'samConstraintSource' | 'samIdealFieldKeys' | 'samIdealReason'>> & {
  samEnabled?: boolean
}

const POST_PROCESS_FIELD_KEYS: SamFactoryFieldKey[] = [
  'deviceCount',
  'deviceShiftMinutes',
  'deviceEfficiencyValue',
  'deviceEfficiencyUnit',
  'staffCount',
  'staffShiftMinutes',
  'staffEfficiencyValue',
  'staffEfficiencyUnit',
  'setupMinutes',
  'switchMinutes',
  'efficiencyFactor',
]

const BATCH_PROCESS_FIELD_KEYS: SamFactoryFieldKey[] = [
  'deviceCount',
  'deviceShiftMinutes',
  'batchLoadCapacity',
  'batchLoadUnit',
  'cycleMinutes',
  'staffCount',
  'staffShiftMinutes',
  'staffEfficiencyValue',
  'staffEfficiencyUnit',
  'setupMinutes',
  'switchMinutes',
  'efficiencyFactor',
]

const STAFF_ONLY_FIELD_KEYS: SamFactoryFieldKey[] = [
  'staffCount',
  'staffShiftMinutes',
  'staffEfficiencyValue',
  'staffEfficiencyUnit',
  'efficiencyFactor',
]

const PROCESS_CURRENT_TEMPLATE_BY_CODE: Record<string, FactorySupplyFormulaTemplate> = {
  PRINT: 'C',
  DYE: 'D',
  CUT_PANEL: 'B',
  EMBROIDERY: 'B',
  PLEATING: 'C',
  SEW: 'A',
  SPECIAL_CRAFT: 'B',
  SHRINKING: 'D',
  POST_FINISHING: 'B',
  BUTTONHOLE: 'B',
  BUTTON_ATTACH: 'B',
  IRONING: 'B',
  PACKAGING: 'B',
}

function resolveProcessCurrentTemplate(processCode: string): FactorySupplyFormulaTemplate {
  return PROCESS_CURRENT_TEMPLATE_BY_CODE[processCode] ?? 'A'
}

const PROCESS_SAM_RULES: Record<string, ProcessSamRule> = {
  PRINT: {
    samEnabled: true,
    samCalcMode: 'CONTINUOUS',
    samDefaultInputUnit: 'METER',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '印花能力受机台速度、单班有效分钟、操作人数、换版换色准备时间共同影响，平台完整理解该工艺时还需要保留设备/人员效率单位作为口径说明。',
  },
  DYE: {
    samEnabled: true,
    samCalcMode: 'BATCH',
    samDefaultInputUnit: 'KG',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...BATCH_PROCESS_FIELD_KEYS],
    samIdealReason: '染色是典型批次型能力，完整建模时既要看设备装载量和循环时长，也要保留装载量单位与人员效率单位作为解释口径。',
  },
  CUT_PANEL: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '裁片既受裁床等设备数量影响，也受铺布和裁剪班组人数影响，完整口径还要保留设备/人员效率单位解释设备节拍与人工效率。',
  },
  EMBROIDERY: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '绣花供给能力受设备、人数和准备损耗共同影响，完整口径保留效率单位是为了明确设备速度与人工产出说明。',
  },
  PLEATING: {
    samEnabled: true,
    samCalcMode: 'CONTINUOUS',
    samDefaultInputUnit: 'METER',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '压褶属于连续推进型能力，完整口径除了设备和人员数值，还需要保留效率单位说明连续推进速度的解释口径。',
  },
  SEW: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'STAFF',
    samIdealFieldKeys: [...STAFF_ONLY_FIELD_KEYS],
    samIdealReason: '普通车缝的基础供给能力主要由可用人力与单位时间产出决定，完整口径仍保留人员效率单位用于解释人工效率口径。',
  },
  SPECIAL_CRAFT: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '特殊工艺工序只是容器；完整口径仍保留设备/人员/准备时间及单位字段，但真正的供给规则要在工艺级明确。',
  },
  SHRINKING: {
    samEnabled: true,
    samCalcMode: 'BATCH',
    samDefaultInputUnit: 'KG',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...BATCH_PROCESS_FIELD_KEYS],
    samIdealReason: '缩水属于批次型能力，完整口径要同时保留装载量单位和人员效率单位，便于解释批次设备能力与人工能力。',
  },
  POST_FINISHING: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '后道对外任务按子节点汇总产能，完整口径需保留设备、人员与准备时间字段，便于解释后道整体供给节拍。',
  },
  BUTTONHOLE: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '开扣眼既受设备数量与效率影响，也受操作人与调机时间影响，完整口径需要保留设备与人员效率单位说明。',
  },
  BUTTON_ATTACH: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samDefaultInputUnit: 'PIECE',
    samIdealReason: '装扣子既包含人工动作，也可能依赖专机与调机，完整口径需要保留设备、人员与准备时间字段。',
  },
  IRONING: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '熨烫既需要工位或设备，也需要稳定的人力投入，完整口径保留设备和人员效率单位用于解释节拍来源。',
  },
  PACKAGING: {
    samEnabled: true,
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '包装产能节点需要同时考虑工位、设备与人员投入，完整口径保留设备、人员与准备时间字段以解释真实供给能力。',
  },
}

const CRAFT_SAM_RULE_OVERRIDES_BY_LEGACY_VALUE: Record<number, CraftSamRuleOverride> = {
  262144: {
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '曲牙虽然归在车缝工序下，但对专机与调机有明显依赖，完整口径必须保留设备、人员与准备时间字段。',
  },
  8: {
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '打揽通常依赖专机和操作人配合，完整口径需要保留设备、人员和准备时间字段。',
  },
  32: {
    samCalcMode: 'CONTINUOUS',
    samDefaultInputUnit: 'METER',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '打条能力按连续长度推进，完整口径必须保留设备/人员效率单位来解释速度口径。',
  },
  64: {
    samCalcMode: 'CONTINUOUS',
    samDefaultInputUnit: 'METER',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '激光切能力受设备速度、有效分钟和调版时间影响明显，完整口径需要保留设备与人员效率说明。',
  },
  8192: {
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '烫画多为设备与操作协同，完整口径需要保留设备、人员与准备时间字段。',
  },
  16384: {
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '直喷供给能力受设备打印效率与校机准备时间影响明显，完整口径需要保留设备、人员与准备时间字段。',
  },
  128: {
    samCalcMode: 'BATCH',
    samDefaultInputUnit: 'KG',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...BATCH_PROCESS_FIELD_KEYS],
    samIdealReason: '洗水按批次处理，供给能力取决于设备装载量、循环时间和人员配置。',
  },
  131072: {
    samCalcMode: 'CONTINUOUS',
    samDefaultInputUnit: 'METER',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '捆条按长度推进，完整口径需要保留设备/人员效率说明和准备时间字段。',
  },
  256: {
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'STAFF',
    samIdealFieldKeys: [...STAFF_ONLY_FIELD_KEYS],
    samIdealReason: '手缝扣主要受人工数量与单位时间产出影响，完整口径保留人员效率单位即可。',
  },
  512: {
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '机打扣依赖专机与操作人共同产出，完整口径需要保留设备、人员与准备时间字段。',
  },
  1024: {
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '四爪扣需要设备模具与人员操作配合，完整口径需要保留设备、人员与准备时间字段。',
  },
  32768: {
    samCalcMode: 'DISCRETE',
    samDefaultInputUnit: 'PIECE',
    samConstraintSource: 'BOTH',
    samIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    samIdealReason: '布包扣通常不是纯人工简单动作，完整口径需要保留设备、人员与准备时间字段。',
  },
}

const REFERENCE_PUBLISHED_SAM_BY_CRAFT_NAME: Record<
  string,
  { value: number; unit: PublishedSamUnit }
> = {
  丝网印: { value: 1.2, unit: 'MINUTE_PER_METER' },
  数码印: { value: 1.5, unit: 'MINUTE_PER_METER' },
  匹染: { value: 80, unit: 'MINUTE_PER_BATCH' },
  色织: { value: 95, unit: 'MINUTE_PER_BATCH' },
  定位裁: { value: 0.6, unit: 'MINUTE_PER_PIECE' },
  定向裁: { value: 0.55, unit: 'MINUTE_PER_PIECE' },
  绣花: { value: 1.8, unit: 'MINUTE_PER_PIECE' },
  贝壳绣: { value: 2.4, unit: 'MINUTE_PER_PIECE' },
  压褶: { value: 0.8, unit: 'MINUTE_PER_METER' },
  基础连接: { value: 0.9, unit: 'MINUTE_PER_PIECE' },
  曲牙: { value: 1.4, unit: 'MINUTE_PER_PIECE' },
  打揽: { value: 1.1, unit: 'MINUTE_PER_PIECE' },
  打条: { value: 0.75, unit: 'MINUTE_PER_METER' },
  激光切: { value: 1.0, unit: 'MINUTE_PER_METER' },
  烫画: { value: 0.7, unit: 'MINUTE_PER_PIECE' },
  直喷: { value: 0.85, unit: 'MINUTE_PER_PIECE' },
  捆条: { value: 0.95, unit: 'MINUTE_PER_METER' },
  缩水: { value: 65, unit: 'MINUTE_PER_BATCH' },
  洗水: { value: 75, unit: 'MINUTE_PER_BATCH' },
  开扣眼: { value: 0.35, unit: 'MINUTE_PER_PIECE' },
  手缝扣: { value: 0.5, unit: 'MINUTE_PER_PIECE' },
  机打扣: { value: 0.28, unit: 'MINUTE_PER_PIECE' },
  四爪扣: { value: 0.32, unit: 'MINUTE_PER_PIECE' },
  布包扣: { value: 0.45, unit: 'MINUTE_PER_PIECE' },
  鸡眼扣: { value: 0.26, unit: 'MINUTE_PER_PIECE' },
  手工盘扣: { value: 1.6, unit: 'MINUTE_PER_PIECE' },
  熨烫: { value: 0.4, unit: 'MINUTE_PER_PIECE' },
  包装: { value: 0.3, unit: 'MINUTE_PER_PIECE' },
}

function getReferencePublishedSamNote(unit: PublishedSamUnit): string {
  if (unit === 'MINUTE_PER_BATCH') {
    return '平台理论参考值，适用于普通复杂度与常规批量；技术包可结合设备装载和批量规模调整当前款发布工时 SAM 基线。'
  }

  if (unit === 'MINUTE_PER_METER') {
    return '平台理论参考值，适用于普通复杂度；技术包可结合门幅、图案长度和工艺难度调整当前款发布工时 SAM 基线。'
  }

  return '平台理论参考值，适用于普通复杂度；技术包可结合款式结构和加工难度调整当前款发布工时 SAM 基线。'
}

const PROCESS_SYSTEM_CODE_MAP: Record<string, string> = {
  PRINT: 'PROC_PRINT',
  DYE: 'PROC_DYE',
  CUT_PANEL: 'PROC_CUT',
  EMBROIDERY: 'PROC_EMBROIDER',
  PLEATING: 'PROC_PLEAT',
  SEW: 'PROC_SEW',
  SPECIAL_CRAFT: 'PROC_SPECIAL_CRAFT',
  SHRINKING: 'PROC_SHRINK',
  POST_FINISHING: 'PROC_FINISHING',
  BUTTONHOLE: 'PROC_BUTTONHOLE',
  BUTTON_ATTACH: 'PROC_BUTTON_ATTACH',
  IRONING: 'PROC_IRON',
  PACKAGING: 'PROC_PACK',
}

const CRAFT_SYSTEM_CODE_BY_LEGACY_VALUE: Record<number, string> = {
  1: 'PROC_POSITION_CUT',
  2: 'PROC_EMBROIDER',
  4: 'PROC_PLEAT',
  8: 'PROC_DALAN',
  16: 'PROC_DIRECTION_CUT',
  32: 'PROC_DATIAO',
  64: 'PROC_LASER_CUT',
  128: 'PROC_WASH',
  256: 'PROC_HAND_BUTTON',
  512: 'PROC_MACHINE_BUTTON',
  1024: 'PROC_FOUR_CLAW',
  2048: 'PROC_EYELET',
  4096: 'PROC_SHRINK',
  8192: 'PROC_TANHUA',
  16384: 'PROC_DIRECT_PRINT',
  32768: 'PROC_CLOTH_BUTTON',
  65536: 'PROC_PANKOU',
  131072: 'PROC_KUNTIAO',
  262144: 'PROC_QUYA',
  262145: 'PROC_BASE_CONNECT',
  524288: 'PROC_BUTTONHOLE',
  1048576: 'PROC_SHELL_EMBROIDER',
  2000001: 'PROC_PRINT',
  2000002: 'PROC_PRINT',
  2000003: 'PROC_DYE',
  2000004: 'PROC_DYE',
  2000005: 'PROC_IRON',
  2000006: 'PROC_PACK',
}

const CARRY_SUGGESTION_BY_PROCESS_CODE: Record<string, string> = {
  PRINT: '印花厂优先',
  DYE: '染色厂优先',
  CUT_PANEL: '裁片厂优先',
  EMBROIDERY: '绣花厂优先',
  PLEATING: '压褶工艺厂优先',
  SEW: '车缝厂优先',
  SPECIAL_CRAFT: '特殊工艺厂优先',
  SHRINKING: '缩水工艺厂优先',
  POST_FINISHING: '后道工厂优先',
  BUTTONHOLE: '后道产能优先',
  BUTTON_ATTACH: '后道产能优先',
  IRONING: '后道产能优先',
  PACKAGING: '后道产能优先',
}

type ProcessDefaultRule = {
  assignmentGranularity: ProcessAssignmentGranularity
  detailSplitMode: DetailSplitMode
  detailSplitDimensions: DetailSplitDimension[]
}

const PROCESS_DEFAULT_RULES: Record<string, ProcessDefaultRule> = {
  PRINT: {
    assignmentGranularity: 'COLOR',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
  },
  DYE: {
    assignmentGranularity: 'COLOR',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_COLOR', 'MATERIAL_SKU'],
  },
  CUT_PANEL: {
    assignmentGranularity: 'ORDER',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_COLOR', 'PATTERN', 'MATERIAL_SKU'],
  },
  EMBROIDERY: {
    assignmentGranularity: 'ORDER',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
  },
  PLEATING: {
    assignmentGranularity: 'ORDER',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
  },
  SEW: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  SPECIAL_CRAFT: {
    assignmentGranularity: 'ORDER',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
  },
  SHRINKING: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  POST_FINISHING: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  BUTTONHOLE: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  BUTTON_ATTACH: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  IRONING: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  PACKAGING: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
}

function toProcessDocType(documentLabel: string): ProcessDocType {
  return documentLabel === '需求单' ? 'DEMAND' : 'TASK'
}

function toTaskTypeMode(isSpecialCraft: boolean): TaskTypeMode {
  return isSpecialCraft ? 'CRAFT' : 'PROCESS'
}

function toCraftCode(legacyValue: number): string {
  return `CRAFT_${String(legacyValue).padStart(6, '0')}`
}

export const processStageDefinitions: ProcessStageDefinition[] = [
  {
    stageCode: 'PREP',
    stageName: '准备阶段',
    sort: 10,
    description: '印花、染色、缩水等产前处理阶段',
  },
  {
    stageCode: 'PROD',
    stageName: '生产阶段',
    sort: 20,
    description: '裁片、绣花、压褶、车缝、特殊工艺等主体生产阶段',
  },
  {
    stageCode: 'POST',
    stageName: '后道阶段',
    sort: 30,
    description: '后道任务与后道产能节点阶段',
  },
]

const processDefinitionSeeds: Array<
  Omit<
    ProcessDefinition,
    | 'systemProcessCode'
    | 'assignmentGranularity'
    | 'detailSplitMode'
    | 'detailSplitDimensions'
    | 'defaultDocType'
    | 'taskTypeMode'
    | 'isSpecialCraftContainer'
    | 'defaultDocLabel'
    | 'samEnabled'
    | 'samCalcMode'
    | 'samDefaultInputUnit'
    | 'samConstraintSource'
    | 'samIdealFieldKeys'
    | 'samIdealReason'
    | 'samCurrentFieldKeys'
    | 'samCurrentFormulaLines'
    | 'samCurrentExplanationLines'
    | 'samCurrentExampleLines'
    | 'samCurrentReason'
    | 'samFactoryFieldKeys'
    | 'samReason'
  > & {
    defaultDocument: string
  }
> = [
  {
    processCode: 'PRINT',
    processName: '印花',
    stageCode: 'PREP',
    sort: 10,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '需求单',
    description: '由BOM上的印花要求触发',
    triggerSource: 'BOM上存在印花要求',
  },
  {
    processCode: 'DYE',
    processName: '染色',
    stageCode: 'PREP',
    sort: 20,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '需求单',
    description: '由BOM上的染色要求触发',
    triggerSource: 'BOM上存在染色要求',
  },
  {
    processCode: 'SHRINKING',
    processName: '缩水',
    stageCode: 'PREP',
    sort: 30,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'CUT_PANEL',
    processName: '裁片',
    stageCode: 'PROD',
    sort: 10,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'EMBROIDERY',
    processName: '绣花',
    stageCode: 'PROD',
    sort: 20,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'PLEATING',
    processName: '压褶',
    stageCode: 'PROD',
    sort: 30,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'SEW',
    processName: '车缝',
    stageCode: 'PROD',
    sort: 40,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'SPECIAL_CRAFT',
    processName: '特殊工艺',
    stageCode: 'PROD',
    sort: 50,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
    description: '用于打揽、打条、捆条、激光切、烫画、直喷等',
  },
  {
    processCode: 'POST_FINISHING',
    processName: '后道',
    stageCode: 'POST',
    sort: 10,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'CHILD_NODES',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'BUTTONHOLE',
    processName: '开扣眼',
    stageCode: 'POST',
    sort: 20,
    processRole: 'INTERNAL_CAPACITY_NODE',
    parentProcessCode: 'POST_FINISHING',
    generatesExternalTask: false,
    requiresTaskQr: false,
    requiresHandoverOrder: false,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'NONE',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'BUTTON_ATTACH',
    processName: '装扣子',
    stageCode: 'POST',
    sort: 30,
    processRole: 'INTERNAL_CAPACITY_NODE',
    parentProcessCode: 'POST_FINISHING',
    generatesExternalTask: false,
    requiresTaskQr: false,
    requiresHandoverOrder: false,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'NONE',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'IRONING',
    processName: '熨烫',
    stageCode: 'POST',
    sort: 40,
    processRole: 'INTERNAL_CAPACITY_NODE',
    parentProcessCode: 'POST_FINISHING',
    generatesExternalTask: false,
    requiresTaskQr: false,
    requiresHandoverOrder: false,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'NONE',
    isActive: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'PACKAGING',
    processName: '包装',
    stageCode: 'POST',
    sort: 50,
    processRole: 'INTERNAL_CAPACITY_NODE',
    parentProcessCode: 'POST_FINISHING',
    generatesExternalTask: false,
    requiresTaskQr: false,
    requiresHandoverOrder: false,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'NONE',
    isActive: true,
    defaultDocument: '任务单',
  },
]

function resolveProcessGranularity(processCode: string): ProcessAssignmentGranularity {
  if (processCode === 'PRINT' || processCode === 'DYE') return 'COLOR'
  if (
    processCode === 'SEW'
    || processCode === 'SHRINKING'
    || processCode === 'POST_FINISHING'
    || processCode === 'BUTTONHOLE'
    || processCode === 'BUTTON_ATTACH'
    || processCode === 'IRONING'
    || processCode === 'PACKAGING'
  ) return 'SKU'
  return 'ORDER'
}

function resolveProcessDefaultRule(processCode: string): ProcessDefaultRule {
  const configured = PROCESS_DEFAULT_RULES[processCode]
  if (configured) return configured

  const assignmentGranularity = resolveProcessGranularity(processCode)
  if (assignmentGranularity === 'SKU') {
    return {
      assignmentGranularity,
      detailSplitMode: 'COMPOSITE',
      detailSplitDimensions: ['GARMENT_SKU'],
    }
  }
  if (assignmentGranularity === 'COLOR') {
    return {
      assignmentGranularity,
      detailSplitMode: 'COMPOSITE',
      detailSplitDimensions: ['GARMENT_COLOR', 'MATERIAL_SKU'],
    }
  }
  return {
    assignmentGranularity,
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
  }
}

function formatDetailSplitDimensions(dimensions: DetailSplitDimension[]): string {
  if (dimensions.length === 0) return '-'
  return dimensions.map((dimension) => DETAIL_SPLIT_DIMENSION_LABEL[dimension]).join(' + ')
}

function orderSamFactoryFieldKeys(keys: SamFactoryFieldKey[]): SamFactoryFieldKey[] {
  const keySet = new Set(keys)
  return SAM_FACTORY_FIELD_ORDER.filter((key) => keySet.has(key))
}

export function listSamFactoryFieldDefinitions(keys?: SamFactoryFieldKey[]): SamFactoryFieldDefinition[] {
  const orderedKeys = keys ? orderSamFactoryFieldKeys(keys) : [...SAM_FACTORY_FIELD_ORDER]
  return orderedKeys.map((key) => SAM_FACTORY_FIELD_DICT[key])
}

export function getSamFactoryFieldDefinitionByKey(
  key: SamFactoryFieldKey,
): SamFactoryFieldDefinition {
  return SAM_FACTORY_FIELD_DICT[key]
}

function formatSamFactoryFieldText(keys: SamFactoryFieldKey[]): string {
  return listSamFactoryFieldDefinitions(keys)
    .map((item) => item.label)
    .join('、')
}

export const processDefinitions: ProcessDefinition[] = processDefinitionSeeds.map((seed) => {
  const defaultDocType = toProcessDocType(seed.defaultDocument)
  const isSpecialCraftContainer = seed.processCode === 'SPECIAL_CRAFT'
  const defaultRule = resolveProcessDefaultRule(seed.processCode)
  const samRule = PROCESS_SAM_RULES[seed.processCode]
  const currentGuide = getFactorySupplyFormulaGuideByTemplate(
    resolveProcessCurrentTemplate(seed.processCode),
    seed.processName,
  )
  return {
    processCode: seed.processCode,
    systemProcessCode: PROCESS_SYSTEM_CODE_MAP[seed.processCode] ?? `PROC_${seed.processCode}`,
    processName: seed.processName,
    stageCode: seed.stageCode,
    sort: seed.sort,
    processRole: seed.processRole,
    parentProcessCode: seed.parentProcessCode,
    generatesExternalTask: seed.generatesExternalTask,
    requiresTaskQr: seed.requiresTaskQr,
    requiresHandoverOrder: seed.requiresHandoverOrder,
    capacityEnabled: seed.capacityEnabled,
    capacityRollupMode: seed.capacityRollupMode,
    factoryMobileExecutionMode: seed.factoryMobileExecutionMode,
    isActive: seed.isActive,
    assignmentGranularity: defaultRule.assignmentGranularity,
    detailSplitMode: defaultRule.detailSplitMode,
    detailSplitDimensions: [...defaultRule.detailSplitDimensions],
    defaultDocType,
    taskTypeMode: isSpecialCraftContainer ? 'CRAFT' : 'PROCESS',
    isSpecialCraftContainer,
    description: seed.description,
    triggerSource: seed.triggerSource,
    defaultDocLabel: PROCESS_DOC_TYPE_LABEL[defaultDocType],
    samEnabled: samRule.samEnabled,
    samCalcMode: samRule.samCalcMode,
    samDefaultInputUnit: samRule.samDefaultInputUnit,
    samConstraintSource: samRule.samConstraintSource,
    samIdealFieldKeys: [...samRule.samIdealFieldKeys],
    samIdealReason: samRule.samIdealReason,
    samCurrentFieldKeys: [...currentGuide.currentFieldKeys],
    samCurrentFormulaLines: [...currentGuide.currentFormulaLines],
    samCurrentExplanationLines: [...currentGuide.currentExplanationLines],
    samCurrentExampleLines: [...currentGuide.currentExampleLines],
    samCurrentReason: currentGuide.currentReason,
    samFactoryFieldKeys: [...currentGuide.currentFieldKeys],
    samReason: currentGuide.currentReason,
  }
})

export const legacyProcessCraftMappings: LegacyCraftMappingDefinition[] = [
  { legacyValue: 1, legacyCraftName: '定位裁', craftName: '定位裁', processCode: 'CUT_PANEL', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 2, legacyCraftName: '绣花', craftName: '绣花', processCode: 'EMBROIDERY', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 4, legacyCraftName: '压褶', craftName: '压褶', processCode: 'PLEATING', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 8, legacyCraftName: '打揽', craftName: '打揽', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 16, legacyCraftName: '定向裁', craftName: '定向裁', processCode: 'CUT_PANEL', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 32, legacyCraftName: '打条', craftName: '打条', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 64, legacyCraftName: '激光切', craftName: '激光切', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 128, legacyCraftName: '洗水', craftName: '洗水', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, isActive: true, defaultDocument: '任务单', remark: '洗水归生产阶段特殊工艺，不再作为独立工序' },
  { legacyValue: 256, legacyCraftName: '手缝扣', craftName: '手缝扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 512, legacyCraftName: '机打扣', craftName: '机打扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 1024, legacyCraftName: '四爪扣', craftName: '四爪扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 2048, legacyCraftName: '鸡眼扣', craftName: '鸡眼扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, isActive: false, defaultDocument: '任务单', remark: '历史停用，不再生成新任务' },
  { legacyValue: 4096, legacyCraftName: '缩水', craftName: '缩水', processCode: 'SHRINKING', isSpecialCraft: false, isActive: true, defaultDocument: '任务单', remark: '缩水归准备阶段' },
  { legacyValue: 8192, legacyCraftName: '烫画', craftName: '烫画', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '通常用于纯色T-shirt，已明确按特殊工艺生成任务单' },
  { legacyValue: 16384, legacyCraftName: '直喷', craftName: '直喷', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '通常用于纯色T-shirt，已明确按特殊工艺生成任务单' },
  { legacyValue: 32768, legacyCraftName: '布包扣', craftName: '布包扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 65536, legacyCraftName: '手工盘扣', craftName: '手工盘扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, isActive: false, defaultDocument: '任务单', remark: '历史停用，不再生成新任务' },
  { legacyValue: 131072, legacyCraftName: '捆条', craftName: '捆条', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 262144, legacyCraftName: '曲牙', craftName: '曲牙', processCode: 'SEW', isSpecialCraft: false, defaultDocument: '任务单', remark: '当前先按车缝归类' },
  { legacyValue: 262145, legacyCraftName: '基础连接', craftName: '基础连接', processCode: 'SEW', isSpecialCraft: false, defaultDocument: '任务单', remark: '当前按普通车缝基线归类' },
  { legacyValue: 524288, legacyCraftName: '开扣眼', craftName: '开扣眼', processCode: 'BUTTONHOLE', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 1048576, legacyCraftName: '贝壳绣', craftName: '贝壳绣', processCode: 'EMBROIDERY', isSpecialCraft: false, defaultDocument: '任务单', remark: '当前先按绣花归类' },
]

const supplementalProcessCraftMappings: LegacyCraftMappingDefinition[] = [
  { legacyValue: 2000001, legacyCraftName: '丝网印', craftName: '丝网印', processCode: 'PRINT', isSpecialCraft: false, defaultDocument: '需求单' },
  { legacyValue: 2000002, legacyCraftName: '数码印', craftName: '数码印', processCode: 'PRINT', isSpecialCraft: false, defaultDocument: '需求单' },
  { legacyValue: 2000003, legacyCraftName: '匹染', craftName: '匹染', processCode: 'DYE', isSpecialCraft: false, defaultDocument: '需求单' },
  { legacyValue: 2000004, legacyCraftName: '色织', craftName: '色织', processCode: 'DYE', isSpecialCraft: false, defaultDocument: '需求单' },
  { legacyValue: 2000005, legacyCraftName: '熨烫', craftName: '熨烫', processCode: 'IRONING', isSpecialCraft: false, isActive: true, defaultDocument: '任务单' },
  { legacyValue: 2000006, legacyCraftName: '包装', craftName: '包装', processCode: 'PACKAGING', isSpecialCraft: false, isActive: true, defaultDocument: '任务单' },
]

const processDefinitionByCode = new Map(processDefinitions.map((item) => [item.processCode, item]))
const processDefinitionBySystemCode = new Map(processDefinitions.map((item) => [item.systemProcessCode, item]))
const stageDefinitionByCode = new Map(processStageDefinitions.map((item) => [item.stageCode, item]))

export const allProcessCraftDefinitions: ProcessCraftDefinition[] = [...legacyProcessCraftMappings, ...supplementalProcessCraftMappings]
  .slice()
  .sort((a, b) => a.legacyValue - b.legacyValue)
  .map((item) => {
    const process = processDefinitionByCode.get(item.processCode)
    const referencePublishedSam = REFERENCE_PUBLISHED_SAM_BY_CRAFT_NAME[item.craftName]
    const samOverride = CRAFT_SAM_RULE_OVERRIDES_BY_LEGACY_VALUE[item.legacyValue]
    const processCurrentTemplate = resolveProcessCurrentTemplate(item.processCode)
    const craftCurrentTemplate = getFactorySupplyFormulaTemplate(item.craftName)
    const craftCurrentGuide = getFactorySupplyFormulaGuide(item.craftName)
    if (!referencePublishedSam) {
      throw new Error(`缺少工艺理论参考值配置：${item.craftName}`)
    }
    const inheritedRule: ProcessDefaultRule = {
      assignmentGranularity: process?.assignmentGranularity ?? 'ORDER',
      detailSplitMode: process?.detailSplitMode ?? 'COMPOSITE',
      detailSplitDimensions: process?.detailSplitDimensions ?? ['PATTERN', 'MATERIAL_SKU'],
    }
    const forceOverrideBySpecialCraft = item.isSpecialCraft
    const resolvedRuleSource: RuleSource = forceOverrideBySpecialCraft
      ? 'OVERRIDE_CRAFT'
      : item.ruleSource ?? 'INHERIT_PROCESS'
    const resolvedAssignmentGranularity =
      resolvedRuleSource === 'OVERRIDE_CRAFT'
        ? item.assignmentGranularity ?? inheritedRule.assignmentGranularity
        : inheritedRule.assignmentGranularity
    const resolvedDetailSplitMode =
      resolvedRuleSource === 'OVERRIDE_CRAFT'
        ? item.detailSplitMode ?? inheritedRule.detailSplitMode
        : inheritedRule.detailSplitMode
    const resolvedDetailSplitDimensions =
      resolvedRuleSource === 'OVERRIDE_CRAFT'
        ? [...(item.detailSplitDimensions ?? inheritedRule.detailSplitDimensions)]
        : [...inheritedRule.detailSplitDimensions]
    const defaultDocType = toProcessDocType(item.defaultDocument)
    return {
      craftCode: toCraftCode(item.legacyValue),
      craftName: item.craftName,
      legacyValue: item.legacyValue,
      legacyCraftName: item.legacyCraftName,
      processCode: item.processCode,
      systemProcessCode: CRAFT_SYSTEM_CODE_BY_LEGACY_VALUE[item.legacyValue] ?? process?.systemProcessCode ?? `PROC_${item.processCode}`,
      stageCode: process?.stageCode ?? 'PROD',
      processRole: process?.processRole ?? 'EXTERNAL_TASK',
      parentProcessCode: process?.parentProcessCode,
      generatesExternalTask: (item.isActive ?? true) && (process?.generatesExternalTask ?? false),
      requiresTaskQr: (item.isActive ?? true) && (process?.requiresTaskQr ?? false),
      requiresHandoverOrder: (item.isActive ?? true) && (process?.requiresHandoverOrder ?? false),
      capacityEnabled: process?.capacityEnabled ?? true,
      capacityRollupMode: process?.capacityRollupMode ?? 'SELF',
      factoryMobileExecutionMode: process?.factoryMobileExecutionMode ?? 'FULL_TASK',
      isActive: item.isActive ?? true,
      assignmentGranularity: resolvedAssignmentGranularity,
      ruleSource: resolvedRuleSource,
      defaultDocType,
      taskTypeMode: toTaskTypeMode(item.isSpecialCraft),
      detailSplitMode: resolvedDetailSplitMode,
      detailSplitDimensions: resolvedDetailSplitDimensions,
      isSpecialCraft: item.isSpecialCraft,
      referencePublishedSamValue: referencePublishedSam.value,
      referencePublishedSamUnit: referencePublishedSam.unit,
      referencePublishedSamNote: getReferencePublishedSamNote(referencePublishedSam.unit),
      carrySuggestion: CARRY_SUGGESTION_BY_PROCESS_CODE[item.processCode] ?? '工艺匹配工厂优先',
      remark: item.remark,
      samEnabled: samOverride?.samEnabled ?? true,
      samCalcMode: samOverride?.samCalcMode,
      samDefaultInputUnit: samOverride?.samDefaultInputUnit,
      samConstraintSource: samOverride?.samConstraintSource,
      samIdealFieldKeys: samOverride?.samIdealFieldKeys ? [...samOverride.samIdealFieldKeys] : undefined,
      samIdealReason: samOverride?.samIdealReason,
      samCurrentFieldKeys:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentFieldKeys],
      samCurrentFormulaLines:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentFormulaLines],
      samCurrentExplanationLines:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentExplanationLines],
      samCurrentExampleLines:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentExampleLines],
      samCurrentReason: craftCurrentTemplate === processCurrentTemplate ? undefined : craftCurrentGuide.currentReason,
      samFactoryFieldKeys:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentFieldKeys],
      samReason: craftCurrentTemplate === processCurrentTemplate ? undefined : craftCurrentGuide.currentReason,
    }
  })

export const processCraftDefinitions: ProcessCraftDefinition[] = allProcessCraftDefinitions.filter((item) => item.isActive)

const processCraftByCode = new Map(allProcessCraftDefinitions.map((item) => [item.craftCode, item]))
const processCraftByLegacyValue = new Map(allProcessCraftDefinitions.map((item) => [item.legacyValue, item]))

export const craftStageDict = processStageDefinitions

export function listProcessStages(): ProcessStageDefinition[] {
  return processStageDefinitions.slice().sort((a, b) => a.sort - b.sort)
}

export function getProcessStageByCode(stageCode: CraftStageCode): ProcessStageDefinition | undefined {
  return stageDefinitionByCode.get(stageCode)
}

export function listProcessDefinitions(): ProcessDefinition[] {
  return processDefinitions
    .slice()
    .sort((a, b) => {
      const stageA = stageDefinitionByCode.get(a.stageCode)?.sort ?? 999
      const stageB = stageDefinitionByCode.get(b.stageCode)?.sort ?? 999
      if (stageA !== stageB) return stageA - stageB
      return a.sort - b.sort
    })
}

export function getProcessDefinitionByCode(processCode: string): ProcessDefinition | undefined {
  return processDefinitionByCode.get(processCode)
}

export function getProcessDefinitionBySystemCode(systemProcessCode: string): ProcessDefinition | undefined {
  return processDefinitionBySystemCode.get(systemProcessCode)
}

export function isExternalTaskProcess(processCode: string): boolean {
  return getProcessDefinitionByCode(processCode)?.generatesExternalTask ?? false
}

export function isPostCapacityNode(processCode: string): boolean {
  const process = getProcessDefinitionByCode(processCode)
  return process?.stageCode === 'POST' && process.processRole === 'INTERNAL_CAPACITY_NODE'
}

export function listProcessesByStageCode(stageCode: CraftStageCode): ProcessDefinition[] {
  return listProcessDefinitions().filter((item) => item.stageCode === stageCode)
}

export function listProcessCraftDefinitions(): ProcessCraftDefinition[] {
  return processCraftDefinitions.slice()
}

export function listAllProcessCraftDefinitions(): ProcessCraftDefinition[] {
  return allProcessCraftDefinitions.slice()
}

export function listInactiveProcessCraftDefinitions(): ProcessCraftDefinition[] {
  return allProcessCraftDefinitions.filter((item) => !item.isActive)
}

export function listProcessCraftDefinitionsByStatus(isActive: boolean): ProcessCraftDefinition[] {
  return allProcessCraftDefinitions.filter((item) => item.isActive === isActive)
}

export function listActiveProcessCraftDefinitions(): ProcessCraftDefinition[] {
  return processCraftDefinitions.slice()
}

export function getProcessCraftByCode(craftCode: string): ProcessCraftDefinition | undefined {
  return processCraftByCode.get(craftCode)
}

export function getProcessCraftByLegacyValue(legacyValue: number): ProcessCraftDefinition | undefined {
  return processCraftByLegacyValue.get(legacyValue)
}

export function listCraftsByProcessCode(processCode: string): ProcessCraftDefinition[] {
  return processCraftDefinitions.filter((item) => item.processCode === processCode)
}

export function listCraftsByStageCode(stageCode: CraftStageCode): ProcessCraftDefinition[] {
  return processCraftDefinitions.filter((item) => item.stageCode === stageCode)
}

export interface ProcessCraftOption {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  label: string
  processRole: ProcessRole
  stageCode: CraftStageCode
  isCapacityNode: boolean
}

function buildProcessCraftOption(definition: ProcessCraftDefinition): ProcessCraftOption | null {
  const row = getProcessCraftDictRowByCode(definition.craftCode)
  if (!row || !row.isActive) return null

  const process = getProcessDefinitionByCode(definition.processCode)
  const isCapacityNode = process?.processRole === 'INTERNAL_CAPACITY_NODE'

  if (isCapacityNode && process?.parentProcessCode) {
    const parent = getProcessDefinitionByCode(process.parentProcessCode)
    const processCode = parent?.processCode ?? row.processCode
    const processName = parent?.processName ?? row.processName
    const craftCode = process.processCode
    const craftName = process.processName

    return {
      processCode,
      processName,
      craftCode,
      craftName,
      label: `${processName} / ${craftName}`,
      processRole: process.processRole,
      stageCode: parent?.stageCode ?? row.stageCode,
      isCapacityNode: true,
    }
  }

  return {
    processCode: row.processCode,
    processName: row.processName,
    craftCode: row.craftCode,
    craftName: row.craftName,
    label: `${row.processName} / ${row.craftName}`,
    processRole: row.processRole,
    stageCode: row.stageCode,
    isCapacityNode: false,
  }
}

function dedupeProcessCraftOptions(options: ProcessCraftOption[]): ProcessCraftOption[] {
  const optionMap = new Map<string, ProcessCraftOption>()
  for (const option of options) {
    optionMap.set(`${option.processCode}::${option.craftCode}`, option)
  }

  return [...optionMap.values()].sort((left, right) => {
    const stageCompare = listProcessStages().findIndex((item) => item.stageCode === left.stageCode)
      - listProcessStages().findIndex((item) => item.stageCode === right.stageCode)
    if (stageCompare !== 0) return stageCompare
    const processCompare = left.processName.localeCompare(right.processName, 'zh-CN')
    if (processCompare !== 0) return processCompare
    return left.craftName.localeCompare(right.craftName, 'zh-CN')
  })
}

export function getActiveProcessCraftOptions(): ProcessCraftOption[] {
  return dedupeProcessCraftOptions(
    listActiveProcessCraftDefinitions()
      .map((item) => buildProcessCraftOption(item))
      .filter((item): item is ProcessCraftOption => Boolean(item)),
  )
}

export function getCapacityProcessCraftOptions(): ProcessCraftOption[] {
  return getActiveProcessCraftOptions().filter((item) => {
    const process = getProcessDefinitionByCode(item.isCapacityNode ? item.craftCode : item.processCode)
    if (item.isCapacityNode) return true
    return process?.capacityEnabled ?? false
  })
}

export function getExternalTaskProcessCraftOptions(): ProcessCraftOption[] {
  return getActiveProcessCraftOptions().filter((item) => !item.isCapacityNode)
}

export function getCapacityNodeProcessCraftOptions(): ProcessCraftOption[] {
  return getActiveProcessCraftOptions().filter((item) => item.isCapacityNode)
}

export function getAssignmentGranularityByCraftCode(craftCode: string): ProcessAssignmentGranularity {
  return processCraftByCode.get(craftCode)?.assignmentGranularity ?? 'ORDER'
}

export function getDetailSplitModeByCraftCode(craftCode: string): DetailSplitMode {
  return processCraftByCode.get(craftCode)?.detailSplitMode ?? 'COMPOSITE'
}

export function getDetailSplitDimensionsByCraftCode(craftCode: string): DetailSplitDimension[] {
  return [...(processCraftByCode.get(craftCode)?.detailSplitDimensions ?? ['PATTERN', 'MATERIAL_SKU'])]
}

export function getRuleSourceByCraftCode(craftCode: string): RuleSource {
  return processCraftByCode.get(craftCode)?.ruleSource ?? 'INHERIT_PROCESS'
}

export function getDefaultDocTypeByCraftCode(craftCode: string): ProcessDocType {
  return processCraftByCode.get(craftCode)?.defaultDocType ?? 'TASK'
}

export function getTaskTypeModeByCraftCode(craftCode: string): TaskTypeMode {
  return processCraftByCode.get(craftCode)?.taskTypeMode ?? 'PROCESS'
}

export function isSpecialCraftByCraftCode(craftCode: string): boolean {
  return processCraftByCode.get(craftCode)?.isSpecialCraft ?? false
}

export interface ResolvedProcessCraftSamRule {
  samEnabled: boolean
  samCalcMode: SamCalcMode
  samDefaultInputUnit: SamInputUnit
  samConstraintSource: CapacityConstraintSource
  samIdealFieldKeys: SamFactoryFieldKey[]
  samIdealReason: string
  samCurrentFieldKeys: SamCurrentFieldKey[]
  samCurrentFormulaLines: string[]
  samCurrentExplanationLines: string[]
  samCurrentExampleLines: string[]
  samCurrentReason: string
}

export function getResolvedProcessCraftSamRuleByCode(
  craftCode: string,
): ResolvedProcessCraftSamRule | undefined {
  const craft = processCraftByCode.get(craftCode)
  if (!craft) return undefined
  const process = processDefinitionByCode.get(craft.processCode)
  if (!process) return undefined
  const currentGuide = getFactorySupplyFormulaGuide(craft.craftName)

  return {
    samEnabled: craft.samEnabled ?? process.samEnabled,
    samCalcMode: craft.samCalcMode ?? process.samCalcMode,
    samDefaultInputUnit: craft.samDefaultInputUnit ?? process.samDefaultInputUnit,
    samConstraintSource: craft.samConstraintSource ?? process.samConstraintSource,
    samIdealFieldKeys: orderSamFactoryFieldKeys(craft.samIdealFieldKeys ?? process.samIdealFieldKeys),
    samIdealReason: craft.samIdealReason ?? process.samIdealReason,
    samCurrentFieldKeys: orderSamFactoryFieldKeys(
      (craft.samCurrentFieldKeys ?? process.samCurrentFieldKeys) as SamFactoryFieldKey[],
    ) as SamCurrentFieldKey[],
    samCurrentFormulaLines: craft.samCurrentFormulaLines
      ? [...craft.samCurrentFormulaLines]
      : [...currentGuide.currentFormulaLines],
    samCurrentExplanationLines: craft.samCurrentExplanationLines
      ? [...craft.samCurrentExplanationLines]
      : [...currentGuide.currentExplanationLines],
    samCurrentExampleLines: craft.samCurrentExampleLines
      ? [...craft.samCurrentExampleLines]
      : [...currentGuide.currentExampleLines],
    samCurrentReason: craft.samCurrentReason ?? process.samCurrentReason,
  }
}

export const allProcessCraftDictRows: ProcessCraftDictRow[] = allProcessCraftDefinitions.map((item) => {
  const process = processDefinitionByCode.get(item.processCode)
  const stage = stageDefinitionByCode.get(item.stageCode)
  const processAssignmentGranularity = process?.assignmentGranularity ?? 'ORDER'
  const processDetailSplitMode = process?.detailSplitMode ?? 'COMPOSITE'
  const processDetailSplitDimensions = [...(process?.detailSplitDimensions ?? ['PATTERN', 'MATERIAL_SKU'])]
  const parentProcess = item.parentProcessCode ? processDefinitionByCode.get(item.parentProcessCode) : undefined
  const samRule =
    getResolvedProcessCraftSamRuleByCode(item.craftCode) ??
    ({
      samEnabled: true,
      samCalcMode: 'DISCRETE',
      samDefaultInputUnit: 'PIECE',
      samConstraintSource: 'STAFF',
      samIdealFieldKeys: ['staffCount', 'staffShiftMinutes', 'staffEfficiencyValue', 'staffEfficiencyUnit', 'efficiencyFactor'],
      samIdealReason: '',
      samCurrentFieldKeys: ['staffCount', 'staffShiftMinutes', 'staffEfficiencyValue', 'efficiencyFactor'],
      samCurrentFormulaLines: [],
      samCurrentExplanationLines: [],
      samCurrentExampleLines: [],
      samCurrentReason: '',
    } satisfies ResolvedProcessCraftSamRule)
  return {
    craftCode: item.craftCode,
    craftName: item.craftName,
    processCode: item.processCode,
    processName: process?.processName ?? item.processCode,
    stageCode: item.stageCode,
    stageName: stage?.stageName ?? item.stageCode,
    isActive: item.isActive,
    statusLabel: toStatusLabel(item.isActive),
    processRole: item.processRole,
    processRoleLabel: PROCESS_ROLE_LABEL[item.processRole],
    taskScopeLabel: PROCESS_ROLE_LABEL[item.processRole],
    parentProcessCode: item.parentProcessCode,
    parentProcessName: parentProcess?.processName,
    generatesExternalTask: item.generatesExternalTask,
    generatesExternalTaskLabel: toYesNoLabel(item.generatesExternalTask),
    requiresTaskQr: item.requiresTaskQr,
    requiresTaskQrLabel: toYesNoLabel(item.requiresTaskQr),
    requiresHandoverOrder: item.requiresHandoverOrder,
    requiresHandoverOrderLabel: toYesNoLabel(item.requiresHandoverOrder),
    capacityEnabled: item.capacityEnabled,
    capacityEnabledLabel: toYesNoLabel(item.capacityEnabled),
    capacityRollupMode: item.capacityRollupMode,
    factoryMobileExecutionMode: item.factoryMobileExecutionMode,
    assignmentGranularity: item.assignmentGranularity,
    assignmentGranularityLabel: PROCESS_ASSIGNMENT_GRANULARITY_LABEL[item.assignmentGranularity],
    ruleSource: item.ruleSource,
    ruleSourceLabel: RULE_SOURCE_LABEL[item.ruleSource],
    detailSplitMode: item.detailSplitMode,
    detailSplitModeLabel: DETAIL_SPLIT_MODE_LABEL[item.detailSplitMode],
    detailSplitDimensions: [...item.detailSplitDimensions],
    detailSplitDimensionsText: formatDetailSplitDimensions(item.detailSplitDimensions),
    handoffAdvice: item.carrySuggestion,
    legacyValue: item.legacyValue,
    legacyCraftName: item.legacyCraftName,
    isSpecialCraft: item.isSpecialCraft,
    defaultDocument: PROCESS_DOC_TYPE_LABEL[item.defaultDocType],
    defaultDocType: item.defaultDocType,
    taskTypeMode: item.taskTypeMode,
    referencePublishedSamValue: item.referencePublishedSamValue,
    referencePublishedSamUnit: item.referencePublishedSamUnit,
    referencePublishedSamUnitLabel: PUBLISHED_SAM_UNIT_LABEL[item.referencePublishedSamUnit],
    referencePublishedSamNote: item.referencePublishedSamNote,
    processAssignmentGranularity,
    processAssignmentGranularityLabel:
      PROCESS_ASSIGNMENT_GRANULARITY_LABEL[processAssignmentGranularity],
    processDetailSplitMode,
    processDetailSplitModeLabel: DETAIL_SPLIT_MODE_LABEL[processDetailSplitMode],
    processDetailSplitDimensions,
    processDetailSplitDimensionsText: formatDetailSplitDimensions(processDetailSplitDimensions),
    remark: item.remark,
    processNote: process?.description,
    triggerSource: process?.triggerSource,
    samEnabled: samRule.samEnabled,
    samCalcMode: samRule.samCalcMode,
    samCalcModeLabel: SAM_CALC_MODE_LABEL[samRule.samCalcMode],
    samDefaultInputUnit: samRule.samDefaultInputUnit,
    samDefaultInputUnitLabel: SAM_INPUT_UNIT_LABEL[samRule.samDefaultInputUnit],
    samConstraintSource: samRule.samConstraintSource,
    samConstraintSourceLabel: CAPACITY_CONSTRAINT_SOURCE_LABEL[samRule.samConstraintSource],
    samIdealFieldKeys: [...samRule.samIdealFieldKeys],
    samIdealFieldText: formatSamFactoryFieldText(samRule.samIdealFieldKeys),
    samIdealReason: samRule.samIdealReason,
    samCurrentFieldKeys: [...samRule.samCurrentFieldKeys],
    samCurrentFieldText: formatSamFactoryFieldText(samRule.samCurrentFieldKeys as SamFactoryFieldKey[]),
    samCurrentFormulaLines: [...samRule.samCurrentFormulaLines],
    samCurrentExplanationLines: [...samRule.samCurrentExplanationLines],
    samCurrentExampleLines: [...samRule.samCurrentExampleLines],
    samCurrentReason: samRule.samCurrentReason,
    samFactoryFieldKeys: [...samRule.samCurrentFieldKeys],
    samFactoryFieldText: formatSamFactoryFieldText(samRule.samCurrentFieldKeys as SamFactoryFieldKey[]),
    samReason: samRule.samCurrentReason,
  }
})

export const processCraftDictRows: ProcessCraftDictRow[] = allProcessCraftDictRows.filter((item) => item.isActive)

export function listProcessCraftDictRows(includeHistorical: boolean = false): ProcessCraftDictRow[] {
  return includeHistorical ? allProcessCraftDictRows.slice() : processCraftDictRows.slice()
}

export function getProcessCraftDictRowByCode(craftCode: string): ProcessCraftDictRow | undefined {
  return allProcessCraftDictRows.find((item) => item.craftCode === craftCode)
}

export interface ActiveProcessCraftRow {
  stageCode: CraftStageCode
  stageName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  processCraftKey: string
  processCraftLabel: string
  isExternalTask: boolean
  isCapacityNode: boolean
}

export interface ActiveProcessOption {
  processCode: string
  processName: string
}

export type ResolvedProcessCraft = ActiveProcessCraftRow

function buildActiveProcessCraftRow(definition: ProcessCraftDefinition): ActiveProcessCraftRow | null {
  if (!definition.isActive) return null

  const process = getProcessDefinitionByCode(definition.processCode)
  if (!process || !process.isActive) return null

  if (process.processRole === 'INTERNAL_CAPACITY_NODE' && process.parentProcessCode) {
    const parent = getProcessDefinitionByCode(process.parentProcessCode)
    if (!parent || !parent.isActive) return null

    return {
      stageCode: parent.stageCode,
      stageName: getProcessStageByCode(parent.stageCode)?.stageName ?? parent.stageCode,
      processCode: parent.processCode,
      processName: parent.processName,
      craftCode: process.processCode,
      craftName: process.processName,
      processCraftKey: `${parent.processCode}::${process.processCode}`,
      processCraftLabel: `${parent.processName} / ${process.processName}`,
      isExternalTask: false,
      isCapacityNode: true,
    }
  }

  return {
    stageCode: definition.stageCode,
    stageName: getProcessStageByCode(definition.stageCode)?.stageName ?? definition.stageCode,
    processCode: process.processCode,
    processName: process.processName,
    craftCode: definition.craftCode,
    craftName: definition.craftName,
    processCraftKey: `${process.processCode}::${definition.craftCode}`,
    processCraftLabel: `${process.processName} / ${definition.craftName}`,
    isExternalTask: process.generatesExternalTask,
    isCapacityNode: false,
  }
}

function sortActiveProcessCraftRows(left: ActiveProcessCraftRow, right: ActiveProcessCraftRow): number {
  const leftStageSort = getProcessStageByCode(left.stageCode)?.sort ?? Number.MAX_SAFE_INTEGER
  const rightStageSort = getProcessStageByCode(right.stageCode)?.sort ?? Number.MAX_SAFE_INTEGER
  if (leftStageSort !== rightStageSort) return leftStageSort - rightStageSort
  const processCompare = left.processName.localeCompare(right.processName, 'zh-CN')
  if (processCompare !== 0) return processCompare
  return left.craftName.localeCompare(right.craftName, 'zh-CN')
}

const activeProcessCraftRows = (() => {
  const rowMap = new Map<string, ActiveProcessCraftRow>()
  for (const definition of listActiveProcessCraftDefinitions()) {
    const row = buildActiveProcessCraftRow(definition)
    if (!row) continue
    rowMap.set(row.processCraftKey, row)
  }
  return [...rowMap.values()].sort(sortActiveProcessCraftRows)
})()

const activeProcessCraftRowByKey = new Map(
  activeProcessCraftRows.map((item) => [item.processCraftKey, item] as const),
)

export function getActiveProcessCraftRows(): ActiveProcessCraftRow[] {
  return activeProcessCraftRows.slice()
}

export function getActiveProcessOptions(): ActiveProcessOption[] {
  const optionMap = new Map<string, ActiveProcessOption>()
  for (const row of activeProcessCraftRows) {
    if (!optionMap.has(row.processCode)) {
      optionMap.set(row.processCode, {
        processCode: row.processCode,
        processName: row.processName,
      })
    }
  }

  return [...optionMap.values()].sort((left, right) => left.processName.localeCompare(right.processName, 'zh-CN'))
}

export function getActiveCraftOptionsByProcess(processCode?: string): ActiveProcessCraftRow[] {
  return activeProcessCraftRows.filter((row) => (processCode ? row.processCode === processCode : true))
}

export function resolveProcessCraft(
  processCode: string,
  craftCode: string,
): ResolvedProcessCraft | null {
  const normalized = activeProcessCraftRowByKey.get(`${processCode}::${craftCode}`)
  if (normalized) return { ...normalized }

  const craft = getProcessCraftByCode(craftCode)
  if (craft?.isActive && craft.processCode === processCode) {
    const process = getProcessDefinitionByCode(processCode)
    if (!process || !process.isActive) return null
    return {
      stageCode: craft.stageCode,
      stageName: getProcessStageByCode(craft.stageCode)?.stageName ?? craft.stageCode,
      processCode,
      processName: process.processName,
      craftCode: craft.craftCode,
      craftName: craft.craftName,
      processCraftKey: `${processCode}::${craft.craftCode}`,
      processCraftLabel: `${process.processName} / ${craft.craftName}`,
      isExternalTask: process.generatesExternalTask,
      isCapacityNode: process.processRole === 'INTERNAL_CAPACITY_NODE',
    }
  }

  const process = getProcessDefinitionByCode(processCode)
  if (process?.processRole === 'INTERNAL_CAPACITY_NODE' && process.parentProcessCode && craftCode === process.processCode) {
    const mapped = activeProcessCraftRowByKey.get(`${process.parentProcessCode}::${process.processCode}`)
    return mapped ? { ...mapped } : null
  }

  return null
}

export function assertProcessCraftExists(
  processCode: string,
  craftCode: string,
  context: string = '工序工艺校验',
): ResolvedProcessCraft {
  const resolved = resolveProcessCraft(processCode, craftCode)
  if (!resolved) {
    throw new Error(`${context}：未找到有效工序工艺组合 ${processCode} / ${craftCode}`)
  }
  return resolved
}
