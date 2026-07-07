import {
  getFactorySupplyFormulaGuide,
  getFactorySupplyFormulaGuideByTemplate,
  getFactorySupplyFormulaTemplate,
  type FactorySupplyFormulaTemplate,
} from './process-craft-output-value-explainer.ts'

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
export type SpecialCraftSupportedTargetObject = 'CUT_PIECE' | 'FULL_FABRIC' | 'SEMI_FINISHED_GARMENT'
export type SpecialCraftTargetObjectLabel = '已裁部位' | '完整面料' | '成衣半成品'
export type ProcessTargetObject = 'CUT_PIECE_PART' | 'FABRIC' | 'ACCESSORY' | 'GARMENT_SEMI'
export type ProcessTargetObjectName = '裁片部位' | '面料' | '辅料' | '成衣半成品'
export type SpecialCraftCategory = 'AUXILIARY' | 'SPECIAL'
export type SpecialCraftCategoryName = '辅助工艺' | '特种工艺'
export type SpecialCraftVisibleFactoryType =
  | 'CENTRAL_SPECIAL'
  | 'SATELLITE_FINISHING'
  | 'CENTRAL_DENIM_WASH'
  | 'CENTRAL_CUTTING'
export type OutputValueCalcMode = 'DISCRETE' | 'CONTINUOUS' | 'BATCH'
export type OutputValueInputUnit = 'PIECE' | 'METER' | 'KG' | 'BATCH'
export type OutputValueUnit =
  | 'VALUE_PER_PIECE'
  | 'VALUE_PER_BATCH'
  | 'VALUE_PER_METER'
  | 'VALUE_PER_DOZEN'
export type CapacityConstraintSource = 'DEVICE' | 'STAFF' | 'BOTH'
export type OutputValueFactoryFieldGroup = 'DEVICE' | 'STAFF' | 'ADJUSTMENT'
export type OutputValueFactoryFieldKey =
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

export type OutputValueCurrentFieldKey = Exclude<
  OutputValueFactoryFieldKey,
  'deviceEfficiencyUnit' | 'staffEfficiencyUnit' | 'batchLoadUnit'
>

export interface OutputValueFactoryFieldDefinition {
  key: OutputValueFactoryFieldKey
  label: string
  group: OutputValueFactoryFieldGroup
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
  outputValueEnabled: boolean
  outputValueCalcMode: OutputValueCalcMode
  outputValueDefaultInputUnit: OutputValueInputUnit
  outputValueConstraintSource: CapacityConstraintSource
  outputValueIdealFieldKeys: OutputValueFactoryFieldKey[]
  outputValueIdealReason: string
  outputValueCurrentFieldKeys: OutputValueCurrentFieldKey[]
  outputValueCurrentFormulaLines: string[]
  outputValueCurrentExplanationLines: string[]
  outputValueCurrentExampleLines: string[]
  outputValueCurrentReason: string
  outputValueFactoryFieldKeys: OutputValueFactoryFieldKey[]
  outputValueReason: string
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
  targetObject: ProcessTargetObject
  targetObjectName: ProcessTargetObjectName
  supportedTargetObjects: SpecialCraftSupportedTargetObject[]
  supportedTargetObjectLabels: SpecialCraftTargetObjectLabel[]
  visibleFactoryTypes: SpecialCraftVisibleFactoryType[]
  referenceOutputValueValue: number
  referenceOutputValueUnit: OutputValueUnit
  referenceOutputValueNote: string
  carrySuggestion: string
  remark?: string
  outputValueEnabled: boolean
  outputValueCalcMode?: OutputValueCalcMode
  outputValueDefaultInputUnit?: OutputValueInputUnit
  outputValueConstraintSource?: CapacityConstraintSource
  outputValueIdealFieldKeys?: OutputValueFactoryFieldKey[]
  outputValueIdealReason?: string
  outputValueCurrentFieldKeys?: OutputValueCurrentFieldKey[]
  outputValueCurrentFormulaLines?: string[]
  outputValueCurrentExplanationLines?: string[]
  outputValueCurrentExampleLines?: string[]
  outputValueCurrentReason?: string
  outputValueFactoryFieldKeys?: OutputValueFactoryFieldKey[]
  outputValueReason?: string
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
  legacy?: boolean
  hiddenInNewDict?: boolean
  remark?: string
}

export interface PreparationProcessDefinition {
  processCode: string
  processName: string
  processStage: CraftStageCode
  processStageName: string
  targetObject: ProcessTargetObject
  targetObjectName: ProcessTargetObjectName
  isAutoGeneratedFromBom: boolean
  bomTriggerField: string
  canGenerateTask: boolean
  description: string
}

export type ProcessCraftManagementDomain =
  | 'AUXILIARY_CRAFT_FACTORY'
  | 'SPECIAL_CRAFT_FACTORY'
  | 'CUTTING_FACTORY'

export type ProcessCraftManagementDomainName =
  | '辅助工艺工厂管理'
  | '特种工艺工厂管理'
  | '裁床厂管理'

export interface ModernSpecialCraftDefinition {
  craftCode: string
  craftName: string
  craftCategory: SpecialCraftCategory
  craftCategoryName: SpecialCraftCategoryName
  specialCraftType: SpecialCraftCategory
  specialCraftTypeName: SpecialCraftCategoryName
  managementDomain: ProcessCraftManagementDomain
  managementDomainName: ProcessCraftManagementDomainName
  targetObject: ProcessTargetObject
  targetObjectName: ProcessTargetObjectName
  canSelectInPatternPiece: boolean
  canSelectInBindingArea: boolean
  canTriggerFromMaterial: boolean
  canGenerateSpecialCraftTask: boolean
  description: string
}

export interface CuttingCraftDefinition {
  craftCode: string
  craftName: string
  processStage: CraftStageCode
  processStageName: string
  processGroup: 'CUTTING'
  processGroupName: '裁床工序'
  targetObject: ProcessTargetObject
  targetObjectName: ProcessTargetObjectName
  description: string
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
  targetObject: ProcessTargetObject
  targetObjectName: ProcessTargetObjectName
  supportedTargetObjects: SpecialCraftSupportedTargetObject[]
  supportedTargetObjectLabels: SpecialCraftTargetObjectLabel[]
  supportedTargetObjectText: string
  visibleFactoryTypes: SpecialCraftVisibleFactoryType[]
  defaultDocument: string
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  referenceOutputValueValue: number
  referenceOutputValueUnit: OutputValueUnit
  referenceOutputValueUnitLabel: string
  referenceOutputValueNote: string
  processAssignmentGranularity: ProcessAssignmentGranularity
  processAssignmentGranularityLabel: string
  processDetailSplitMode: DetailSplitMode
  processDetailSplitModeLabel: string
  processDetailSplitDimensions: DetailSplitDimension[]
  processDetailSplitDimensionsText: string
  remark?: string
  processNote?: string
  triggerSource?: string
  outputValueEnabled: boolean
  outputValueCalcMode: OutputValueCalcMode
  outputValueCalcModeLabel: string
  outputValueDefaultInputUnit: OutputValueInputUnit
  outputValueDefaultInputUnitLabel: string
  outputValueConstraintSource: CapacityConstraintSource
  outputValueConstraintSourceLabel: string
  outputValueIdealFieldKeys: OutputValueFactoryFieldKey[]
  outputValueIdealFieldText: string
  outputValueIdealReason: string
  outputValueCurrentFieldKeys: OutputValueCurrentFieldKey[]
  outputValueCurrentFieldText: string
  outputValueCurrentFormulaLines: string[]
  outputValueCurrentExplanationLines: string[]
  outputValueCurrentExampleLines: string[]
  outputValueCurrentReason: string
  outputValueFactoryFieldKeys: OutputValueFactoryFieldKey[]
  outputValueFactoryFieldText: string
  outputValueReason: string
}

export const PROCESS_ASSIGNMENT_GRANULARITY_LABEL: Record<ProcessAssignmentGranularity, string> = {
  ORDER: '按生产单',
  COLOR: '按颜色',
  SKU: '按SKU',
  DETAIL: '按明细行',
}

export const SPECIAL_CRAFT_TARGET_OBJECT_LABEL: Record<SpecialCraftSupportedTargetObject, SpecialCraftTargetObjectLabel> = {
  CUT_PIECE: '已裁部位',
  FULL_FABRIC: '完整面料',
  SEMI_FINISHED_GARMENT: '成衣半成品',
}

export const PROCESS_TARGET_OBJECT_NAME: Record<ProcessTargetObject, ProcessTargetObjectName> = {
  CUT_PIECE_PART: '裁片部位',
  FABRIC: '面料',
  ACCESSORY: '辅料',
  GARMENT_SEMI: '成衣半成品',
}

export const SPECIAL_CRAFT_CATEGORY_NAME: Record<SpecialCraftCategory, SpecialCraftCategoryName> = {
  AUXILIARY: '辅助工艺',
  SPECIAL: '特种工艺',
}

export const PROCESS_CRAFT_MANAGEMENT_DOMAIN_NAME: Record<ProcessCraftManagementDomain, ProcessCraftManagementDomainName> = {
  AUXILIARY_CRAFT_FACTORY: '辅助工艺工厂管理',
  SPECIAL_CRAFT_FACTORY: '特种工艺工厂管理',
  CUTTING_FACTORY: '裁床厂管理',
}

const AUXILIARY_CRAFT_FACTORY_CRAFT_NAMES = new Set([
  '绣花',
  '打条',
  '压褶',
  '打揽',
  '烫画',
  '直喷',
  '贝壳绣',
  '曲牙绣',
  '一字贝绣花',
])

const SPECIAL_CRAFT_FACTORY_CRAFT_NAMES = new Set([
  '模板工序',
  '模板机',
  '激光开袋',
  '特种车缝（花样机）',
  '特种车缝',
  '橡筋定长切割',
  '激光切',
])

const CUTTING_FACTORY_CRAFT_NAMES = new Set(['捆条'])

const SPECIAL_CRAFT_SUPPORTED_TARGET_OBJECTS_BY_LEGACY_VALUE: Record<number, SpecialCraftSupportedTargetObject[]> = {
  8: ['CUT_PIECE'],
  32: ['CUT_PIECE'],
  64: ['CUT_PIECE'],
  128: ['FULL_FABRIC'],
  8192: ['SEMI_FINISHED_GARMENT'],
  16384: ['CUT_PIECE', 'FULL_FABRIC'],
  131072: ['CUT_PIECE'],
}

const SPECIAL_CRAFT_VISIBLE_FACTORY_TYPES_BY_LEGACY_VALUE: Record<number, SpecialCraftVisibleFactoryType[]> = {
  8: ['CENTRAL_SPECIAL', 'SATELLITE_FINISHING'],
  32: ['CENTRAL_SPECIAL', 'SATELLITE_FINISHING'],
  64: ['CENTRAL_SPECIAL', 'SATELLITE_FINISHING'],
  128: ['CENTRAL_DENIM_WASH'],
  8192: ['CENTRAL_SPECIAL', 'SATELLITE_FINISHING'],
  16384: ['CENTRAL_SPECIAL', 'SATELLITE_FINISHING'],
  131072: ['CENTRAL_SPECIAL', 'SATELLITE_FINISHING'],
}

export const preparationProcessDefinitions: PreparationProcessDefinition[] = [
  {
    processCode: 'PREP_SHRINKING',
    processName: '缩水',
    processStage: 'PREP',
    processStageName: '准备阶段',
    targetObject: 'FABRIC',
    targetObjectName: '面料',
    isAutoGeneratedFromBom: true,
    bomTriggerField: 'shrinkRequirement',
    canGenerateTask: true,
    description: '由物料清单中的缩水需求触发，面料生产前进行缩水处理。',
  },
  {
    processCode: 'PREP_WASHING',
    processName: '洗水',
    processStage: 'PREP',
    processStageName: '准备阶段',
    targetObject: 'FABRIC',
    targetObjectName: '面料',
    isAutoGeneratedFromBom: true,
    bomTriggerField: 'washRequirement',
    canGenerateTask: true,
    description: '由物料清单中的洗水需求触发，面料生产前进行洗水处理。',
  },
]

export const modernSpecialCraftDefinitions: ModernSpecialCraftDefinition[] = [
  {
    craftCode: 'AUX_EMBROIDERY',
    craftName: '绣花',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级辅助工艺，可在纸样裁片部位上维护。',
  },
  {
    craftCode: 'AUX_STRIP',
    craftName: '打条',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级辅助工艺，随裁片部位生成特殊工艺任务。',
  },
  {
    craftCode: 'AUX_PLEATING',
    craftName: '压褶',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级辅助工艺，按裁片部位维护。',
  },
  {
    craftCode: 'AUX_DALAN',
    craftName: '打揽',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级辅助工艺，按菲票流转。',
  },
  {
    craftCode: 'AUX_HEAT_TRANSFER',
    craftName: '烫画',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'GARMENT_SEMI',
    targetObjectName: '成衣半成品',
    canSelectInPatternPiece: false,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '纯色 T-shirt 成衣半成品烫画，按 SKU 件数执行。',
  },
  {
    craftCode: 'AUX_DIRECT_PRINT',
    craftName: '直喷',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级辅助工艺，按裁片部位执行。',
  },
  {
    craftCode: 'AUX_SHELL_EMBROIDERY',
    craftName: '贝壳绣',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级辅助工艺，归入辅助工艺管理。',
  },
  {
    craftCode: 'AUX_CURVED_TEETH_EMBROIDERY',
    craftName: '曲牙绣',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级辅助工艺，按裁片部位维护。',
  },
  {
    craftCode: 'AUX_STRAIGHT_SHELL_EMBROIDERY',
    craftName: '一字贝绣花',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'AUXILIARY_CRAFT_FACTORY',
    managementDomainName: '辅助工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级辅助工艺，按裁片部位维护。',
  },
  {
    craftCode: 'AUX_BINDING_STRIP',
    craftName: '捆条',
    craftCategory: 'AUXILIARY',
    craftCategoryName: '辅助工艺',
    specialCraftType: 'AUXILIARY',
    specialCraftTypeName: '辅助工艺',
    managementDomain: 'CUTTING_FACTORY',
    managementDomainName: '裁床厂管理',
    targetObject: 'FABRIC',
    targetObjectName: '面料',
    canSelectInPatternPiece: false,
    canSelectInBindingArea: true,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '捆条跟随纸样维护，不在单个裁片实例特殊工艺列中选择。',
  },
  {
    craftCode: 'SPECIAL_TEMPLATE_PROCESS',
    craftName: '模板工序',
    craftCategory: 'SPECIAL',
    craftCategoryName: '特种工艺',
    specialCraftType: 'SPECIAL',
    specialCraftTypeName: '特种工艺',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    managementDomainName: '特种工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级特种工艺，适用于模板辅助加工。',
  },
  {
    craftCode: 'SPECIAL_LASER_POCKET',
    craftName: '激光开袋',
    craftCategory: 'SPECIAL',
    craftCategoryName: '特种工艺',
    specialCraftType: 'SPECIAL',
    specialCraftTypeName: '特种工艺',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    managementDomainName: '特种工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级特种工艺，适用于激光定位开袋。',
  },
  {
    craftCode: 'SPECIAL_PATTERN_MACHINE_SEWING',
    craftName: '特种车缝（花样机）',
    craftCategory: 'SPECIAL',
    craftCategoryName: '特种工艺',
    specialCraftType: 'SPECIAL',
    specialCraftTypeName: '特种工艺',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    managementDomainName: '特种工艺工厂管理',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    canSelectInPatternPiece: true,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: false,
    canGenerateSpecialCraftTask: true,
    description: '裁片部位级特种工艺，适用于花样机加工。',
  },
  {
    craftCode: 'SPECIAL_ELASTIC_FIXED_LENGTH_CUTTING',
    craftName: '橡筋定长切割',
    craftCategory: 'SPECIAL',
    craftCategoryName: '特种工艺',
    specialCraftType: 'SPECIAL',
    specialCraftTypeName: '特种工艺',
    managementDomain: 'SPECIAL_CRAFT_FACTORY',
    managementDomainName: '特种工艺工厂管理',
    targetObject: 'ACCESSORY',
    targetObjectName: '辅料',
    canSelectInPatternPiece: false,
    canSelectInBindingArea: false,
    canTriggerFromMaterial: true,
    canGenerateSpecialCraftTask: true,
    description: '橡筋定长切割针对辅料，不在裁片明细逐片特殊工艺中选择。',
  },
]

export const cuttingCraftDefinitions: CuttingCraftDefinition[] = [
  {
    craftCode: 'CUTTING_NORMAL',
    craftName: '普通裁',
    processStage: 'PROD',
    processStageName: '生产阶段',
    processGroup: 'CUTTING',
    processGroupName: '裁床工序',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    description: '常规裁床裁剪工艺。',
  },
  {
    craftCode: 'CUTTING_LASER_POSITIONING',
    craftName: '激光定位裁',
    processStage: 'PROD',
    processStageName: '生产阶段',
    processGroup: 'CUTTING',
    processGroupName: '裁床工序',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    description: '按激光定位要求进行裁剪。',
  },
  {
    craftCode: 'CUTTING_DIRECTIONAL',
    craftName: '定向裁',
    processStage: 'PROD',
    processStageName: '生产阶段',
    processGroup: 'CUTTING',
    processGroupName: '裁床工序',
    targetObject: 'CUT_PIECE_PART',
    targetObjectName: '裁片部位',
    description: '按方向、纹路或图案要求定向裁剪。',
  },
]

function resolveSpecialCraftSupportedTargetObjects(
  item: Pick<LegacyCraftMappingDefinition, 'legacyValue' | 'isSpecialCraft'>,
): SpecialCraftSupportedTargetObject[] {
  if (!item.isSpecialCraft) return []
  return [...(SPECIAL_CRAFT_SUPPORTED_TARGET_OBJECTS_BY_LEGACY_VALUE[item.legacyValue] ?? ['CUT_PIECE'])]
}

function resolveSpecialCraftVisibleFactoryTypes(
  item: Pick<LegacyCraftMappingDefinition, 'legacyValue' | 'isSpecialCraft'>,
): SpecialCraftVisibleFactoryType[] {
  if (!item.isSpecialCraft) return []
  return [...(SPECIAL_CRAFT_VISIBLE_FACTORY_TYPES_BY_LEGACY_VALUE[item.legacyValue] ?? ['CENTRAL_SPECIAL'])]
}

export function getSpecialCraftTargetObjectLabel(
  targetObject: SpecialCraftSupportedTargetObject,
): SpecialCraftTargetObjectLabel {
  return SPECIAL_CRAFT_TARGET_OBJECT_LABEL[targetObject]
}

export function getSpecialCraftSupportedTargetObjectLabels(
  targetObjects: SpecialCraftSupportedTargetObject[],
): SpecialCraftTargetObjectLabel[] {
  return targetObjects.map((item) => SPECIAL_CRAFT_TARGET_OBJECT_LABEL[item])
}

export function isSpecialCraftTargetObjectLabel(value: string | undefined): value is SpecialCraftTargetObjectLabel {
  return value === '已裁部位' || value === '完整面料' || value === '成衣半成品'
}

export function normalizeSpecialCraftTargetObjectLabel(
  value: string | undefined,
): SpecialCraftTargetObjectLabel | '' {
  if (value === '裁片') return '已裁部位'
  if (value === '面料') return '完整面料'
  if (value === '半成品' || value === '成衣' || value === '整件成衣') return '成衣半成品'
  return isSpecialCraftTargetObjectLabel(value) ? value : ''
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

export const OUTPUT_VALUE_CALC_MODE_LABEL: Record<OutputValueCalcMode, string> = {
  DISCRETE: '离散型',
  CONTINUOUS: '连续型',
  BATCH: '批次型',
}

export const OUTPUT_VALUE_INPUT_UNIT_LABEL: Record<OutputValueInputUnit, string> = {
  PIECE: '按件录入',
  METER: '按米录入',
  KG: '按公斤录入',
  BATCH: '按批次录入',
}

export const OUTPUT_VALUE_UNIT_LABEL: Record<OutputValueUnit, string> = {
  VALUE_PER_PIECE: '产值/件',
  VALUE_PER_BATCH: '产值/批',
  VALUE_PER_METER: '产值/米',
  VALUE_PER_DOZEN: '产值/打',
}

export const CAPACITY_CONSTRAINT_SOURCE_LABEL: Record<CapacityConstraintSource, string> = {
  DEVICE: '设备约束',
  STAFF: '人员约束',
  BOTH: '设备+人员共同约束',
}

export const OUTPUT_VALUE_FACTORY_FIELD_GROUP_LABEL: Record<OutputValueFactoryFieldGroup, string> = {
  DEVICE: '设备',
  STAFF: '人员',
  ADJUSTMENT: '调整',
}

export const OUTPUT_VALUE_FACTORY_FIELD_ORDER: OutputValueFactoryFieldKey[] = [
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

export const OUTPUT_VALUE_FACTORY_FIELD_DICT: Record<OutputValueFactoryFieldKey, OutputValueFactoryFieldDefinition> = {
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

type ProcessOutputValueRule = {
  outputValueEnabled: boolean
  outputValueCalcMode: OutputValueCalcMode
  outputValueDefaultInputUnit: OutputValueInputUnit
  outputValueConstraintSource: CapacityConstraintSource
  outputValueIdealFieldKeys: OutputValueFactoryFieldKey[]
  outputValueIdealReason: string
}

type CraftOutputValueRuleOverride = Partial<Pick<ProcessOutputValueRule, 'outputValueCalcMode' | 'outputValueDefaultInputUnit' | 'outputValueConstraintSource' | 'outputValueIdealFieldKeys' | 'outputValueIdealReason'>> & {
  outputValueEnabled?: boolean
}

const POST_PROCESS_FIELD_KEYS: OutputValueFactoryFieldKey[] = [
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

const BATCH_PROCESS_FIELD_KEYS: OutputValueFactoryFieldKey[] = [
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

const STAFF_ONLY_FIELD_KEYS: OutputValueFactoryFieldKey[] = [
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
  WOOL: 'B',
  SEW: 'A',
  SPECIAL_CRAFT: 'B',
  SHRINKING: 'D',
  WASHING: 'D',
  POST_FINISHING: 'B',
  BUTTONHOLE: 'B',
  BUTTON_ATTACH: 'B',
  IRONING: 'B',
  PACKAGING: 'B',
}

function resolveProcessCurrentTemplate(processCode: string): FactorySupplyFormulaTemplate {
  return PROCESS_CURRENT_TEMPLATE_BY_CODE[processCode] ?? 'A'
}

const PROCESS_OUTPUT_VALUE_RULES: Record<string, ProcessOutputValueRule> = {
  PRINT: {
    outputValueEnabled: true,
    outputValueCalcMode: 'CONTINUOUS',
    outputValueDefaultInputUnit: 'METER',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '印花能力受机台速度、单班有效分钟、操作人数、换版换色准备时间共同影响，平台完整理解该工艺时还需要保留设备/人员效率单位作为口径说明。',
  },
  DYE: {
    outputValueEnabled: true,
    outputValueCalcMode: 'BATCH',
    outputValueDefaultInputUnit: 'KG',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...BATCH_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '染色是典型批次型能力，完整建模时既要看设备装载量和循环时长，也要保留装载量单位与人员效率单位作为解释口径。',
  },
  CUT_PANEL: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '裁片既受裁床等设备数量影响，也受铺布和裁剪班组人数影响，完整口径还要保留设备/人员效率单位解释设备节拍与人工效率。',
  },
  EMBROIDERY: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '绣花供给能力受设备、人数和准备损耗共同影响，完整口径保留效率单位是为了明确设备速度与人工产出说明。',
  },
  PLEATING: {
    outputValueEnabled: true,
    outputValueCalcMode: 'CONTINUOUS',
    outputValueDefaultInputUnit: 'METER',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '压褶属于连续推进型能力，完整口径除了设备和人员数值，还需要保留效率单位说明连续推进速度的解释口径。',
  },
  WOOL: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '毛织供给能力同时受横机机台、操作人、纱线准备和换色换款准备影响，完整口径需要保留设备、人员与准备时间字段。',
  },
  SEW: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'STAFF',
    outputValueIdealFieldKeys: [...STAFF_ONLY_FIELD_KEYS],
    outputValueIdealReason: '普通车缝的基础供给能力主要由可用人力与单位时间产出决定，完整口径仍保留人员效率单位用于解释人工效率口径。',
  },
  SPECIAL_CRAFT: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '特殊工艺工序只是容器；完整口径仍保留设备/人员/准备时间及单位字段，但真正的供给规则要在工艺级明确。',
  },
  SHRINKING: {
    outputValueEnabled: true,
    outputValueCalcMode: 'BATCH',
    outputValueDefaultInputUnit: 'KG',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...BATCH_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '缩水属于批次型能力，完整口径要同时保留装载量单位和人员效率单位，便于解释批次设备能力与人工能力。',
  },
  WASHING: {
    outputValueEnabled: true,
    outputValueCalcMode: 'BATCH',
    outputValueDefaultInputUnit: 'KG',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...BATCH_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '洗水属于准备阶段面料批次处理，完整口径要保留装载量、循环时间、人员与设备配置。',
  },
  POST_FINISHING: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '后道对外任务按子节点汇总产能，完整口径需保留设备、人员与准备时间字段，便于解释后道整体供给节拍。',
  },
  BUTTONHOLE: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '开扣眼既受设备数量与效率影响，也受操作人与调机准备影响，完整口径需要保留设备与人员效率单位说明。',
  },
  BUTTON_ATTACH: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueDefaultInputUnit: 'PIECE',
    outputValueIdealReason: '装扣子既包含人工动作，也可能依赖专机与调机，完整口径需要保留设备、人员与准备时间字段。',
  },
  IRONING: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '熨烫既需要工位或设备，也需要稳定的人力投入，完整口径保留设备和人员效率单位用于解释节拍来源。',
  },
  PACKAGING: {
    outputValueEnabled: true,
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '包装产能节点需要同时考虑工位、设备与人员投入，完整口径保留设备、人员与准备时间字段以解释真实供给能力。',
  },
}

const CRAFT_OUTPUT_VALUE_RULE_OVERRIDES_BY_LEGACY_VALUE: Record<number, CraftOutputValueRuleOverride> = {
  262144: {
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '曲牙虽然归在车缝工序下，但对专机与调机有明显依赖，完整口径必须保留设备、人员与准备时间字段。',
  },
  8: {
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '打揽通常依赖专机和操作人配合，完整口径需要保留设备、人员和准备时间字段。',
  },
  32: {
    outputValueCalcMode: 'CONTINUOUS',
    outputValueDefaultInputUnit: 'METER',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '打条能力按连续长度推进，完整口径必须保留设备/人员效率单位来解释速度口径。',
  },
  64: {
    outputValueCalcMode: 'CONTINUOUS',
    outputValueDefaultInputUnit: 'METER',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '激光切能力受设备速度、有效分钟和调版时间影响明显，完整口径需要保留设备与人员效率说明。',
  },
  8192: {
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '烫画多为设备与操作协同，完整口径需要保留设备、人员与准备时间字段。',
  },
  16384: {
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '直喷供给能力受设备打印效率与校机准备时间影响明显，完整口径需要保留设备、人员与准备时间字段。',
  },
  128: {
    outputValueCalcMode: 'BATCH',
    outputValueDefaultInputUnit: 'KG',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...BATCH_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '洗水按批次处理，供给能力取决于设备装载量、循环时间和人员配置。',
  },
  131072: {
    outputValueCalcMode: 'CONTINUOUS',
    outputValueDefaultInputUnit: 'METER',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '捆条按长度推进，完整口径需要保留设备/人员效率说明和准备时间字段。',
  },
  256: {
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'STAFF',
    outputValueIdealFieldKeys: [...STAFF_ONLY_FIELD_KEYS],
    outputValueIdealReason: '手缝扣主要受人工数量与单位时间产出影响，完整口径保留人员效率单位即可。',
  },
  512: {
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '机打扣依赖专机与操作人共同产出，完整口径需要保留设备、人员与准备时间字段。',
  },
  1024: {
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '四爪扣需要设备模具与人员操作配合，完整口径需要保留设备、人员与准备时间字段。',
  },
  32768: {
    outputValueCalcMode: 'DISCRETE',
    outputValueDefaultInputUnit: 'PIECE',
    outputValueConstraintSource: 'BOTH',
    outputValueIdealFieldKeys: [...POST_PROCESS_FIELD_KEYS],
    outputValueIdealReason: '布包扣通常不是纯人工简单动作，完整口径需要保留设备、人员与准备时间字段。',
  },
}

const REFERENCE_OUTPUT_VALUE_BY_CRAFT_NAME: Record<
  string,
  { value: number; unit: OutputValueUnit }
> = {
  丝网印: { value: 1.2, unit: 'VALUE_PER_METER' },
  数码印: { value: 1.5, unit: 'VALUE_PER_METER' },
  匹染: { value: 80, unit: 'VALUE_PER_BATCH' },
  色织: { value: 95, unit: 'VALUE_PER_BATCH' },
  普通裁: { value: 0.5, unit: 'VALUE_PER_PIECE' },
  定位裁: { value: 0.6, unit: 'VALUE_PER_PIECE' },
  激光定位裁: { value: 0.65, unit: 'VALUE_PER_PIECE' },
  定向裁: { value: 0.55, unit: 'VALUE_PER_PIECE' },
  绣花: { value: 1.8, unit: 'VALUE_PER_PIECE' },
  贝壳绣: { value: 2.4, unit: 'VALUE_PER_PIECE' },
  曲牙绣: { value: 1.6, unit: 'VALUE_PER_PIECE' },
  一字贝绣花: { value: 2.1, unit: 'VALUE_PER_PIECE' },
  压褶: { value: 0.8, unit: 'VALUE_PER_METER' },
  基础连接: { value: 0.9, unit: 'VALUE_PER_PIECE' },
  曲牙: { value: 1.4, unit: 'VALUE_PER_PIECE' },
  打揽: { value: 1.1, unit: 'VALUE_PER_PIECE' },
  打条: { value: 0.75, unit: 'VALUE_PER_METER' },
  激光切: { value: 1.0, unit: 'VALUE_PER_METER' },
  模板工序: { value: 0.9, unit: 'VALUE_PER_PIECE' },
  激光开袋: { value: 1.2, unit: 'VALUE_PER_PIECE' },
  '特种车缝（花样机）': { value: 1.3, unit: 'VALUE_PER_PIECE' },
  烫画: { value: 0.7, unit: 'VALUE_PER_PIECE' },
  整件毛织: { value: 18, unit: 'VALUE_PER_PIECE' },
  部位毛织: { value: 2.5, unit: 'VALUE_PER_PIECE' },
  直喷: { value: 0.85, unit: 'VALUE_PER_PIECE' },
  捆条: { value: 0.95, unit: 'VALUE_PER_METER' },
  橡筋定长切割: { value: 0.4, unit: 'VALUE_PER_METER' },
  缩水: { value: 65, unit: 'VALUE_PER_BATCH' },
  洗水: { value: 75, unit: 'VALUE_PER_BATCH' },
  开扣眼: { value: 0.35, unit: 'VALUE_PER_PIECE' },
  手缝扣: { value: 0.5, unit: 'VALUE_PER_PIECE' },
  机打扣: { value: 0.28, unit: 'VALUE_PER_PIECE' },
  四爪扣: { value: 0.32, unit: 'VALUE_PER_PIECE' },
  布包扣: { value: 0.45, unit: 'VALUE_PER_PIECE' },
  熨烫: { value: 0.4, unit: 'VALUE_PER_PIECE' },
  包装: { value: 0.3, unit: 'VALUE_PER_PIECE' },
}

function getReferenceOutputValueNote(unit: OutputValueUnit): string {
  if (unit === 'VALUE_PER_BATCH') {
    return '平台理论参考值，适用于普通复杂度与常规批量；技术包可结合设备装载和批量规模调整当前款产值 基线。'
  }

  if (unit === 'VALUE_PER_METER') {
    return '平台理论参考值，适用于普通复杂度；技术包可结合门幅、图案长度和工艺难度调整当前款产值 基线。'
  }

  return '平台理论参考值，适用于普通复杂度；技术包可结合款式结构和加工难度调整当前款产值 基线。'
}

const PROCESS_SYSTEM_CODE_MAP: Record<string, string> = {
  PRINT: 'PROC_PRINT',
  DYE: 'PROC_DYE',
  CUT_PANEL: 'PROC_CUT',
  EMBROIDERY: 'PROC_EMBROIDER',
  PLEATING: 'PROC_PLEAT',
  WOOL: 'PROC_WOOL',
  SEW: 'PROC_SEW',
  SPECIAL_CRAFT: 'PROC_SPECIAL_CRAFT',
  SHRINKING: 'PROC_SHRINK',
  WASHING: 'PROC_WASH',
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
  4096: 'PROC_SHRINK',
  8192: 'PROC_TANHUA',
  16384: 'PROC_DIRECT_PRINT',
  32768: 'PROC_CLOTH_BUTTON',
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
  2000007: 'PROC_WOOL',
  2000008: 'PROC_WOOL',
}

const CARRY_SUGGESTION_BY_PROCESS_CODE: Record<string, string> = {
  PRINT: '印花厂优先',
  DYE: '染色厂优先',
  CUT_PANEL: '裁片厂优先',
  EMBROIDERY: '绣花厂优先',
  PLEATING: '压褶工艺厂优先',
  WOOL: '周哥毛织厂优先',
  SEW: '车缝厂优先',
  SPECIAL_CRAFT: '特殊工艺厂优先',
  SHRINKING: '缩水工艺厂优先',
  WASHING: '洗水工艺厂优先',
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
  WOOL: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
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
  WASHING: {
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
    description: '印花、染色、缩水、洗水等产前处理阶段',
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
    | 'outputValueEnabled'
    | 'outputValueCalcMode'
    | 'outputValueDefaultInputUnit'
    | 'outputValueConstraintSource'
    | 'outputValueIdealFieldKeys'
    | 'outputValueIdealReason'
    | 'outputValueCurrentFieldKeys'
    | 'outputValueCurrentFormulaLines'
    | 'outputValueCurrentExplanationLines'
    | 'outputValueCurrentExampleLines'
    | 'outputValueCurrentReason'
    | 'outputValueFactoryFieldKeys'
    | 'outputValueReason'
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
    processCode: 'WASHING',
    processName: '洗水',
    stageCode: 'PREP',
    sort: 35,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
    description: '由BOM上的洗水需求触发，作为准备阶段面料处理工序。',
    triggerSource: 'BOM上存在洗水需求',
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
    processCode: 'WOOL',
    processName: '毛织',
    stageCode: 'PROD',
    sort: 35,
    processRole: 'EXTERNAL_TASK',
    generatesExternalTask: true,
    requiresTaskQr: true,
    requiresHandoverOrder: true,
    capacityEnabled: true,
    capacityRollupMode: 'SELF',
    factoryMobileExecutionMode: 'FULL_TASK',
    isActive: true,
    defaultDocument: '任务单',
    description: '周哥毛织厂自有毛织加工，支持整件毛织和部位毛织。',
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
    || processCode === 'WOOL'
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

function orderOutputValueFactoryFieldKeys(keys: OutputValueFactoryFieldKey[]): OutputValueFactoryFieldKey[] {
  const keySet = new Set(keys)
  return OUTPUT_VALUE_FACTORY_FIELD_ORDER.filter((key) => keySet.has(key))
}

export function listOutputValueFactoryFieldDefinitions(keys?: OutputValueFactoryFieldKey[]): OutputValueFactoryFieldDefinition[] {
  const orderedKeys = keys ? orderOutputValueFactoryFieldKeys(keys) : [...OUTPUT_VALUE_FACTORY_FIELD_ORDER]
  return orderedKeys.map((key) => OUTPUT_VALUE_FACTORY_FIELD_DICT[key])
}

export function getOutputValueFactoryFieldDefinitionByKey(
  key: OutputValueFactoryFieldKey,
): OutputValueFactoryFieldDefinition {
  return OUTPUT_VALUE_FACTORY_FIELD_DICT[key]
}

function formatOutputValueFactoryFieldText(keys: OutputValueFactoryFieldKey[]): string {
  return listOutputValueFactoryFieldDefinitions(keys)
    .map((item) => item.label)
    .join('、')
}

export const processDefinitions: ProcessDefinition[] = processDefinitionSeeds.map((seed) => {
  const defaultDocType = toProcessDocType(seed.defaultDocument)
  const isSpecialCraftContainer = seed.processCode === 'SPECIAL_CRAFT'
  const defaultRule = resolveProcessDefaultRule(seed.processCode)
  const outputValueRule = PROCESS_OUTPUT_VALUE_RULES[seed.processCode]
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
    outputValueEnabled: outputValueRule.outputValueEnabled,
    outputValueCalcMode: outputValueRule.outputValueCalcMode,
    outputValueDefaultInputUnit: outputValueRule.outputValueDefaultInputUnit,
    outputValueConstraintSource: outputValueRule.outputValueConstraintSource,
    outputValueIdealFieldKeys: [...outputValueRule.outputValueIdealFieldKeys],
    outputValueIdealReason: outputValueRule.outputValueIdealReason,
    outputValueCurrentFieldKeys: [...currentGuide.currentFieldKeys],
    outputValueCurrentFormulaLines: [...currentGuide.currentFormulaLines],
    outputValueCurrentExplanationLines: [...currentGuide.currentExplanationLines],
    outputValueCurrentExampleLines: [...currentGuide.currentExampleLines],
    outputValueCurrentReason: currentGuide.currentReason,
    outputValueFactoryFieldKeys: [...currentGuide.currentFieldKeys],
    outputValueReason: currentGuide.currentReason,
  }
})

export const legacyProcessCraftMappings: LegacyCraftMappingDefinition[] = [
  { legacyValue: 1, legacyCraftName: '定位裁', craftName: '定位裁', processCode: 'CUT_PANEL', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 2, legacyCraftName: '绣花', craftName: '绣花', processCode: 'EMBROIDERY', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 4, legacyCraftName: '压褶', craftName: '压褶', processCode: 'PLEATING', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 8, legacyCraftName: '打揽', craftName: '打揽', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺加工单管理' },
  { legacyValue: 16, legacyCraftName: '定向裁', craftName: '定向裁', processCode: 'CUT_PANEL', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 32, legacyCraftName: '打条', craftName: '打条', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺加工单管理' },
  { legacyValue: 64, legacyCraftName: '激光切', craftName: '激光切', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺加工单管理' },
  { legacyValue: 128, legacyCraftName: '洗水', craftName: '洗水', processCode: 'WASHING', isSpecialCraft: false, isActive: true, defaultDocument: '任务单', legacy: true, hiddenInNewDict: true, remark: '旧特殊工艺口径已迁移为准备阶段面料洗水工序，不再作为裁片部位特殊工艺选择项' },
  { legacyValue: 256, legacyCraftName: '手缝扣', craftName: '手缝扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 512, legacyCraftName: '机打扣', craftName: '机打扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 1024, legacyCraftName: '四爪扣', craftName: '四爪扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 4096, legacyCraftName: '缩水', craftName: '缩水', processCode: 'SHRINKING', isSpecialCraft: false, isActive: true, defaultDocument: '任务单', remark: '缩水归准备阶段' },
  { legacyValue: 8192, legacyCraftName: '烫画', craftName: '烫画', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '通常用于纯色T-shirt，已明确按特殊工艺加工单管理' },
  { legacyValue: 16384, legacyCraftName: '直喷', craftName: '直喷', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '通常用于纯色T-shirt，已明确按特殊工艺加工单管理' },
  { legacyValue: 32768, legacyCraftName: '布包扣', craftName: '布包扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 131072, legacyCraftName: '捆条', craftName: '捆条', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺加工单管理' },
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
  {
    legacyValue: 2000007,
    legacyCraftName: '整件毛织',
    craftName: '整件毛织',
    processCode: 'WOOL',
    isSpecialCraft: false,
    isActive: true,
    defaultDocument: '任务单',
    ruleSource: 'OVERRIDE_CRAFT',
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
    remark: '整件毛织完成后交后道工厂，熨烫为必有节点，包装按单据要求决定。',
  },
  {
    legacyValue: 2000008,
    legacyCraftName: '部位毛织',
    craftName: '部位毛织',
    processCode: 'WOOL',
    isSpecialCraft: false,
    isActive: true,
    defaultDocument: '任务单',
    ruleSource: 'OVERRIDE_CRAFT',
    assignmentGranularity: 'DETAIL',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'GARMENT_SKU'],
    remark: '部位毛织按毛织部位打印菲票，完成后交裁床待交出仓。',
  },
]

const modernSpecialCraftProcessMappings: LegacyCraftMappingDefinition[] = modernSpecialCraftDefinitions
  .filter(
    (craft) =>
      !legacyProcessCraftMappings.some(
        (item) => item.processCode === 'SPECIAL_CRAFT' && item.craftName === craft.craftName,
      ),
  )
  .map((craft, index) => ({
    legacyValue: 3000001 + index,
    legacyCraftName: craft.craftName,
    craftName: craft.craftName,
    processCode: 'SPECIAL_CRAFT',
    isSpecialCraft: true,
    defaultDocument: '任务单',
    remark: `${craft.craftCategoryName}，适用对象：${craft.targetObjectName}`,
  }))

const processDefinitionByCode = new Map(processDefinitions.map((item) => [item.processCode, item]))
const processDefinitionBySystemCode = new Map(processDefinitions.map((item) => [item.systemProcessCode, item]))
const stageDefinitionByCode = new Map(processStageDefinitions.map((item) => [item.stageCode, item]))

function resolveProcessCraftManagementDomain(
  item: Pick<LegacyCraftMappingDefinition, 'craftName' | 'processCode'>,
): { managementDomain?: ProcessCraftManagementDomain; managementDomainName?: ProcessCraftManagementDomainName } {
  const modernSpecialCraft = modernSpecialCraftDefinitions.find((craft) => craft.craftName === item.craftName)
  if (modernSpecialCraft) {
    return {
      managementDomain: modernSpecialCraft.managementDomain,
      managementDomainName: modernSpecialCraft.managementDomainName,
    }
  }

  if (CUTTING_FACTORY_CRAFT_NAMES.has(item.craftName)) {
    return {
      managementDomain: 'CUTTING_FACTORY',
      managementDomainName: PROCESS_CRAFT_MANAGEMENT_DOMAIN_NAME.CUTTING_FACTORY,
    }
  }

  if (AUXILIARY_CRAFT_FACTORY_CRAFT_NAMES.has(item.craftName)) {
    return {
      managementDomain: 'AUXILIARY_CRAFT_FACTORY',
      managementDomainName: PROCESS_CRAFT_MANAGEMENT_DOMAIN_NAME.AUXILIARY_CRAFT_FACTORY,
    }
  }

  if (SPECIAL_CRAFT_FACTORY_CRAFT_NAMES.has(item.craftName) || item.processCode === 'SPECIAL_CRAFT') {
    return {
      managementDomain: 'SPECIAL_CRAFT_FACTORY',
      managementDomainName: PROCESS_CRAFT_MANAGEMENT_DOMAIN_NAME.SPECIAL_CRAFT_FACTORY,
    }
  }

  return {}
}

function resolveProcessCraftTargetObject(
  item: Pick<LegacyCraftMappingDefinition, 'craftName' | 'processCode'>,
): { targetObject: ProcessTargetObject; targetObjectName: ProcessTargetObjectName } {
  const modernSpecialCraft = modernSpecialCraftDefinitions.find((craft) => craft.craftName === item.craftName)
  if (modernSpecialCraft) {
    return {
      targetObject: modernSpecialCraft.targetObject,
      targetObjectName: modernSpecialCraft.targetObjectName,
    }
  }

  const preparationProcess = preparationProcessDefinitions.find(
    (process) => process.processName === item.craftName || process.processCode === item.processCode,
  )
  if (preparationProcess) {
    return {
      targetObject: preparationProcess.targetObject,
      targetObjectName: preparationProcess.targetObjectName,
    }
  }

  const cuttingCraft = cuttingCraftDefinitions.find((craft) => craft.craftName === item.craftName)
  if (cuttingCraft) {
    return {
      targetObject: cuttingCraft.targetObject,
      targetObjectName: cuttingCraft.targetObjectName,
    }
  }

  if (item.processCode === 'PRINT' || item.processCode === 'DYE' || item.processCode === 'SHRINKING' || item.processCode === 'WASHING') {
    return { targetObject: 'FABRIC', targetObjectName: '面料' }
  }
  if (item.processCode === 'BUTTON_ATTACH') {
    return { targetObject: 'ACCESSORY', targetObjectName: '辅料' }
  }
  if (item.processCode === 'WOOL') {
    return item.craftName === '部位毛织'
      ? { targetObject: 'CUT_PIECE_PART', targetObjectName: '裁片部位' }
      : { targetObject: 'GARMENT_SEMI', targetObjectName: '成衣半成品' }
  }
  return { targetObject: 'CUT_PIECE_PART', targetObjectName: '裁片部位' }
}

export const allProcessCraftDefinitions: ProcessCraftDefinition[] = [
  ...legacyProcessCraftMappings,
  ...supplementalProcessCraftMappings,
  ...modernSpecialCraftProcessMappings,
]
  .slice()
  .sort((a, b) => a.legacyValue - b.legacyValue)
  .map((item) => {
    const process = processDefinitionByCode.get(item.processCode)
    const referenceOutputValue = REFERENCE_OUTPUT_VALUE_BY_CRAFT_NAME[item.craftName]
    const outputValueOverride = CRAFT_OUTPUT_VALUE_RULE_OVERRIDES_BY_LEGACY_VALUE[item.legacyValue]
    const processCurrentTemplate = resolveProcessCurrentTemplate(item.processCode)
    const craftCurrentTemplate = getFactorySupplyFormulaTemplate(item.craftName)
    const craftCurrentGuide = getFactorySupplyFormulaGuide(item.craftName)
    const targetObjectInfo = resolveProcessCraftTargetObject(item)
    const managementDomainInfo = resolveProcessCraftManagementDomain(item)
    if (!referenceOutputValue) {
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
      targetObject: targetObjectInfo.targetObject,
      targetObjectName: targetObjectInfo.targetObjectName,
      ...managementDomainInfo,
      supportedTargetObjects: resolveSpecialCraftSupportedTargetObjects(item),
      supportedTargetObjectLabels: getSpecialCraftSupportedTargetObjectLabels(
        resolveSpecialCraftSupportedTargetObjects(item),
      ),
      visibleFactoryTypes: resolveSpecialCraftVisibleFactoryTypes(item),
      referenceOutputValueValue: referenceOutputValue.value,
      referenceOutputValueUnit: referenceOutputValue.unit,
      referenceOutputValueNote: getReferenceOutputValueNote(referenceOutputValue.unit),
      carrySuggestion: CARRY_SUGGESTION_BY_PROCESS_CODE[item.processCode] ?? '工艺匹配工厂优先',
      remark: item.remark,
      outputValueEnabled: outputValueOverride?.outputValueEnabled ?? true,
      outputValueCalcMode: outputValueOverride?.outputValueCalcMode,
      outputValueDefaultInputUnit: outputValueOverride?.outputValueDefaultInputUnit,
      outputValueConstraintSource: outputValueOverride?.outputValueConstraintSource,
      outputValueIdealFieldKeys: outputValueOverride?.outputValueIdealFieldKeys ? [...outputValueOverride.outputValueIdealFieldKeys] : undefined,
      outputValueIdealReason: outputValueOverride?.outputValueIdealReason,
      outputValueCurrentFieldKeys:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentFieldKeys],
      outputValueCurrentFormulaLines:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentFormulaLines],
      outputValueCurrentExplanationLines:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentExplanationLines],
      outputValueCurrentExampleLines:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentExampleLines],
      outputValueCurrentReason: craftCurrentTemplate === processCurrentTemplate ? undefined : craftCurrentGuide.currentReason,
      outputValueFactoryFieldKeys:
        craftCurrentTemplate === processCurrentTemplate ? undefined : [...craftCurrentGuide.currentFieldKeys],
      outputValueReason: craftCurrentTemplate === processCurrentTemplate ? undefined : craftCurrentGuide.currentReason,
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

export function listDefaultProcessRouteOrders(): Array<{
  processCode: string
  processName: string
  stageCode: CraftStageCode
  stageName: string
  routeOrder: number
}> {
  return listProcessDefinitions().map((process, index) => ({
    processCode: process.processCode,
    processName: process.processName,
    stageCode: process.stageCode,
    stageName: getProcessStageByCode(process.stageCode)?.stageName ?? process.stageCode,
    routeOrder: index + 1,
  }))
}

export function getDefaultProcessRouteOrder(processCode: string): number {
  return listDefaultProcessRouteOrders().find((item) => item.processCode === processCode)?.routeOrder ?? Number.MAX_SAFE_INTEGER
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

export function getSpecialCraftSupportedTargetObjectsByCraftCode(
  craftCode: string,
): SpecialCraftSupportedTargetObject[] {
  return [...(getProcessCraftByCode(craftCode)?.supportedTargetObjects ?? [])]
}

export function getSpecialCraftVisibleFactoryTypesByCraftCode(
  craftCode: string,
): SpecialCraftVisibleFactoryType[] {
  return [...(getProcessCraftByCode(craftCode)?.visibleFactoryTypes ?? [])]
}

export function listCraftsByProcessCode(processCode: string): ProcessCraftDefinition[] {
  return processCraftDefinitions.filter((item) => item.processCode === processCode)
}

export function listCraftsByStageCode(stageCode: CraftStageCode): ProcessCraftDefinition[] {
  return processCraftDefinitions.filter((item) => item.stageCode === stageCode)
}

export function listSelectableSpecialCraftDefinitions(): ProcessCraftDefinition[] {
  return processCraftDefinitions.filter(
    (item) =>
      item.isSpecialCraft
      && item.processCode === 'SPECIAL_CRAFT',
  )
}

function clonePreparationProcess(item: PreparationProcessDefinition): PreparationProcessDefinition {
  return { ...item }
}

function cloneModernSpecialCraft(item: ModernSpecialCraftDefinition): ModernSpecialCraftDefinition {
  return { ...item }
}

function cloneCuttingCraft(item: CuttingCraftDefinition): CuttingCraftDefinition {
  return { ...item }
}

function findModernSpecialCraft(craftCodeOrName: string): ModernSpecialCraftDefinition | undefined {
  return modernSpecialCraftDefinitions.find(
    (item) => item.craftCode === craftCodeOrName || item.craftName === craftCodeOrName,
  )
}

export function listCraftsByManagementDomain(domain: ProcessCraftManagementDomain): ModernSpecialCraftDefinition[] {
  return modernSpecialCraftDefinitions
    .filter((item) => item.managementDomain === domain)
    .map((item) => cloneModernSpecialCraft(item))
}

export function getCraftManagementDomain(craftCodeOrName: string): ProcessCraftManagementDomain | undefined {
  return findModernSpecialCraft(craftCodeOrName)?.managementDomain
}

export function getCraftManagementDomainName(craftCodeOrName: string): ProcessCraftManagementDomainName | undefined {
  return findModernSpecialCraft(craftCodeOrName)?.managementDomainName
}

export function listPreparationProcesses(): PreparationProcessDefinition[] {
  return preparationProcessDefinitions.map((item) => clonePreparationProcess(item))
}

export function listSpecialCrafts(): ModernSpecialCraftDefinition[] {
  return modernSpecialCraftDefinitions.map((item) => cloneModernSpecialCraft(item))
}

export function listAuxiliaryCrafts(): ModernSpecialCraftDefinition[] {
  return modernSpecialCraftDefinitions
    .filter((item) => item.craftCategory === 'AUXILIARY')
    .map((item) => cloneModernSpecialCraft(item))
}

export function listSpecialTypeCrafts(): ModernSpecialCraftDefinition[] {
  return modernSpecialCraftDefinitions
    .filter((item) => item.craftCategory === 'SPECIAL')
    .map((item) => cloneModernSpecialCraft(item))
}

export function listCutPiecePartCrafts(): ModernSpecialCraftDefinition[] {
  return modernSpecialCraftDefinitions
    .filter((item) => item.targetObject === 'CUT_PIECE_PART' && item.canSelectInPatternPiece)
    .map((item) => cloneModernSpecialCraft(item))
}

export function listFabricCrafts(): ModernSpecialCraftDefinition[] {
  return modernSpecialCraftDefinitions
    .filter((item) => item.targetObject === 'FABRIC')
    .map((item) => cloneModernSpecialCraft(item))
}

export function listAccessoryCrafts(): ModernSpecialCraftDefinition[] {
  return modernSpecialCraftDefinitions
    .filter((item) => item.targetObject === 'ACCESSORY')
    .map((item) => cloneModernSpecialCraft(item))
}

export function listCuttingCrafts(): CuttingCraftDefinition[] {
  return cuttingCraftDefinitions.map((item) => cloneCuttingCraft(item))
}

export function getCraftTargetObject(craftCodeOrName: string): ProcessTargetObject | undefined {
  const modernCraft = findModernSpecialCraft(craftCodeOrName)
  if (modernCraft) return modernCraft.targetObject
  const cuttingCraft = cuttingCraftDefinitions.find(
    (item) => item.craftCode === craftCodeOrName || item.craftName === craftCodeOrName,
  )
  if (cuttingCraft) return cuttingCraft.targetObject
  const preparationProcess = preparationProcessDefinitions.find(
    (item) => item.processCode === craftCodeOrName || item.processName === craftCodeOrName,
  )
  if (preparationProcess) return preparationProcess.targetObject
  const legacyCraft = getProcessCraftByCode(craftCodeOrName) ?? getProcessCraftByLegacyValue(Number(craftCodeOrName))
  if (legacyCraft) {
    const migratedCraft = findModernSpecialCraft(legacyCraft.craftName)
    if (migratedCraft) return migratedCraft.targetObject
    if (legacyCraft.craftName === '洗水' || legacyCraft.craftName === '缩水') return 'FABRIC'
  }
  return undefined
}

export function canSelectCraftInPatternPiece(craftCodeOrName: string): boolean {
  const modernCraft = findModernSpecialCraft(craftCodeOrName)
  if (modernCraft) return modernCraft.canSelectInPatternPiece
  const legacyCraft = getProcessCraftByCode(craftCodeOrName) ?? getProcessCraftByLegacyValue(Number(craftCodeOrName))
  if (!legacyCraft) return false
  const migratedCraft = findModernSpecialCraft(legacyCraft.craftName)
  return migratedCraft?.canSelectInPatternPiece ?? false
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

export interface ResolvedProcessCraftOutputValueRule {
  outputValueEnabled: boolean
  outputValueCalcMode: OutputValueCalcMode
  outputValueDefaultInputUnit: OutputValueInputUnit
  outputValueConstraintSource: CapacityConstraintSource
  outputValueIdealFieldKeys: OutputValueFactoryFieldKey[]
  outputValueIdealReason: string
  outputValueCurrentFieldKeys: OutputValueCurrentFieldKey[]
  outputValueCurrentFormulaLines: string[]
  outputValueCurrentExplanationLines: string[]
  outputValueCurrentExampleLines: string[]
  outputValueCurrentReason: string
}

export function getResolvedProcessCraftOutputValueRuleByCode(
  craftCode: string,
): ResolvedProcessCraftOutputValueRule | undefined {
  const craft = processCraftByCode.get(craftCode)
  if (!craft) return undefined
  const process = processDefinitionByCode.get(craft.processCode)
  if (!process) return undefined
  const currentGuide = getFactorySupplyFormulaGuide(craft.craftName)

  return {
    outputValueEnabled: craft.outputValueEnabled ?? process.outputValueEnabled,
    outputValueCalcMode: craft.outputValueCalcMode ?? process.outputValueCalcMode,
    outputValueDefaultInputUnit: craft.outputValueDefaultInputUnit ?? process.outputValueDefaultInputUnit,
    outputValueConstraintSource: craft.outputValueConstraintSource ?? process.outputValueConstraintSource,
    outputValueIdealFieldKeys: orderOutputValueFactoryFieldKeys(craft.outputValueIdealFieldKeys ?? process.outputValueIdealFieldKeys),
    outputValueIdealReason: craft.outputValueIdealReason ?? process.outputValueIdealReason,
    outputValueCurrentFieldKeys: orderOutputValueFactoryFieldKeys(
      (craft.outputValueCurrentFieldKeys ?? process.outputValueCurrentFieldKeys) as OutputValueFactoryFieldKey[],
    ) as OutputValueCurrentFieldKey[],
    outputValueCurrentFormulaLines: craft.outputValueCurrentFormulaLines
      ? [...craft.outputValueCurrentFormulaLines]
      : [...currentGuide.currentFormulaLines],
    outputValueCurrentExplanationLines: craft.outputValueCurrentExplanationLines
      ? [...craft.outputValueCurrentExplanationLines]
      : [...currentGuide.currentExplanationLines],
    outputValueCurrentExampleLines: craft.outputValueCurrentExampleLines
      ? [...craft.outputValueCurrentExampleLines]
      : [...currentGuide.currentExampleLines],
    outputValueCurrentReason: craft.outputValueCurrentReason ?? process.outputValueCurrentReason,
  }
}

export const allProcessCraftDictRows: ProcessCraftDictRow[] = allProcessCraftDefinitions.map((item) => {
  const process = processDefinitionByCode.get(item.processCode)
  const stage = stageDefinitionByCode.get(item.stageCode)
  const processAssignmentGranularity = process?.assignmentGranularity ?? 'ORDER'
  const processDetailSplitMode = process?.detailSplitMode ?? 'COMPOSITE'
  const processDetailSplitDimensions = [...(process?.detailSplitDimensions ?? ['PATTERN', 'MATERIAL_SKU'])]
  const parentProcess = item.parentProcessCode ? processDefinitionByCode.get(item.parentProcessCode) : undefined
  const outputValueRule =
    getResolvedProcessCraftOutputValueRuleByCode(item.craftCode) ??
    ({
      outputValueEnabled: true,
      outputValueCalcMode: 'DISCRETE',
      outputValueDefaultInputUnit: 'PIECE',
      outputValueConstraintSource: 'STAFF',
      outputValueIdealFieldKeys: ['staffCount', 'staffShiftMinutes', 'staffEfficiencyValue', 'staffEfficiencyUnit', 'efficiencyFactor'],
      outputValueIdealReason: '',
      outputValueCurrentFieldKeys: ['staffCount', 'staffShiftMinutes', 'staffEfficiencyValue', 'efficiencyFactor'],
      outputValueCurrentFormulaLines: [],
      outputValueCurrentExplanationLines: [],
      outputValueCurrentExampleLines: [],
      outputValueCurrentReason: '',
    } satisfies ResolvedProcessCraftOutputValueRule)
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
    targetObject: item.targetObject,
    targetObjectName: item.targetObjectName,
    supportedTargetObjects: [...item.supportedTargetObjects],
    supportedTargetObjectLabels: [...item.supportedTargetObjectLabels],
    supportedTargetObjectText: item.supportedTargetObjectLabels.join('、'),
    visibleFactoryTypes: [...item.visibleFactoryTypes],
    defaultDocument: PROCESS_DOC_TYPE_LABEL[item.defaultDocType],
    defaultDocType: item.defaultDocType,
    taskTypeMode: item.taskTypeMode,
    referenceOutputValueValue: item.referenceOutputValueValue,
    referenceOutputValueUnit: item.referenceOutputValueUnit,
    referenceOutputValueUnitLabel: OUTPUT_VALUE_UNIT_LABEL[item.referenceOutputValueUnit],
    referenceOutputValueNote: item.referenceOutputValueNote,
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
    outputValueEnabled: outputValueRule.outputValueEnabled,
    outputValueCalcMode: outputValueRule.outputValueCalcMode,
    outputValueCalcModeLabel: OUTPUT_VALUE_CALC_MODE_LABEL[outputValueRule.outputValueCalcMode],
    outputValueDefaultInputUnit: outputValueRule.outputValueDefaultInputUnit,
    outputValueDefaultInputUnitLabel: OUTPUT_VALUE_INPUT_UNIT_LABEL[outputValueRule.outputValueDefaultInputUnit],
    outputValueConstraintSource: outputValueRule.outputValueConstraintSource,
    outputValueConstraintSourceLabel: CAPACITY_CONSTRAINT_SOURCE_LABEL[outputValueRule.outputValueConstraintSource],
    outputValueIdealFieldKeys: [...outputValueRule.outputValueIdealFieldKeys],
    outputValueIdealFieldText: formatOutputValueFactoryFieldText(outputValueRule.outputValueIdealFieldKeys),
    outputValueIdealReason: outputValueRule.outputValueIdealReason,
    outputValueCurrentFieldKeys: [...outputValueRule.outputValueCurrentFieldKeys],
    outputValueCurrentFieldText: formatOutputValueFactoryFieldText(outputValueRule.outputValueCurrentFieldKeys as OutputValueFactoryFieldKey[]),
    outputValueCurrentFormulaLines: [...outputValueRule.outputValueCurrentFormulaLines],
    outputValueCurrentExplanationLines: [...outputValueRule.outputValueCurrentExplanationLines],
    outputValueCurrentExampleLines: [...outputValueRule.outputValueCurrentExampleLines],
    outputValueCurrentReason: outputValueRule.outputValueCurrentReason,
    outputValueFactoryFieldKeys: [...outputValueRule.outputValueCurrentFieldKeys],
    outputValueFactoryFieldText: formatOutputValueFactoryFieldText(outputValueRule.outputValueCurrentFieldKeys as OutputValueFactoryFieldKey[]),
    outputValueReason: outputValueRule.outputValueCurrentReason,
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
