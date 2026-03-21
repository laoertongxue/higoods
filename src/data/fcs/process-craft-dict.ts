export type ProcessAssignmentGranularity = 'ORDER' | 'COLOR' | 'SKU' | 'DETAIL'
export type CraftStageCode = 'PREP' | 'PROD' | 'POST'
export type ProcessDocType = 'DEMAND' | 'TASK'
export type TaskTypeMode = 'PROCESS' | 'CRAFT'
export type DetailSplitMode = 'COMPOSITE'
export type DetailSplitDimension = 'PATTERN' | 'MATERIAL_SKU' | 'GARMENT_COLOR' | 'GARMENT_SKU'
export type RuleSource = 'INHERIT_PROCESS' | 'OVERRIDE_CRAFT'

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
  assignmentGranularity: ProcessAssignmentGranularity
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  detailSplitMode: DetailSplitMode
  detailSplitDimensions: DetailSplitDimension[]
  isSpecialCraftContainer: boolean
  description?: string
  triggerSource?: string
  defaultDocLabel: string
}

export interface ProcessCraftDefinition {
  craftCode: string
  craftName: string
  legacyValue: number
  legacyCraftName: string
  processCode: string
  systemProcessCode: string
  stageCode: CraftStageCode
  assignmentGranularity: ProcessAssignmentGranularity
  ruleSource: RuleSource
  defaultDocType: ProcessDocType
  taskTypeMode: TaskTypeMode
  detailSplitMode: DetailSplitMode
  detailSplitDimensions: DetailSplitDimension[]
  isSpecialCraft: boolean
  carrySuggestion: string
  remark?: string
}

export interface LegacyCraftMappingDefinition {
  legacyValue: number
  legacyCraftName: string
  craftName: string
  processCode: string
  isSpecialCraft: boolean
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
  processAssignmentGranularity: ProcessAssignmentGranularity
  processAssignmentGranularityLabel: string
  processDetailSplitMode: DetailSplitMode
  processDetailSplitModeLabel: string
  processDetailSplitDimensions: DetailSplitDimension[]
  processDetailSplitDimensionsText: string
  remark?: string
  processNote?: string
  triggerSource?: string
}

export const PROCESS_ASSIGNMENT_GRANULARITY_LABEL: Record<ProcessAssignmentGranularity, string> = {
  ORDER: '按生产单',
  COLOR: '按颜色',
  SKU: '按SKU',
  DETAIL: '按明细行',
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

export const TASK_TYPE_MODE_LABEL: Record<TaskTypeMode, string> = {
  PROCESS: '按工序',
  CRAFT: '按工艺',
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
  WASHING: 'PROC_WASH',
  BUTTONHOLE: 'PROC_BUTTONHOLE',
  BUTTON_ATTACH: 'PROC_MACHINE_BUTTON',
  HARDWARE: 'PROC_EYELET',
  FROG_BUTTON: 'PROC_PANKOU',
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
  524288: 'PROC_BUTTONHOLE',
  1048576: 'PROC_SHELL_EMBROIDER',
  2000001: 'PROC_PRINT',
  2000002: 'PROC_PRINT',
  2000003: 'PROC_DYE',
  2000004: 'PROC_DYE',
  2000101: 'PROC_SPECIAL_PRINT',
  2000102: 'PROC_SPECIAL_DYE',
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
  WASHING: '洗水厂优先',
  BUTTONHOLE: '后道辅料厂优先',
  BUTTON_ATTACH: '后道辅料厂优先',
  HARDWARE: '五金/辅料厂优先',
  FROG_BUTTON: '盘扣工艺厂优先',
  IRONING: '后道整烫优先',
  PACKAGING: '后道包装优先',
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
  WASHING: {
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
  HARDWARE: {
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  FROG_BUTTON: {
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
    description: '仅包含印花和染色两个工序，不属于成衣主体制造阶段',
  },
  {
    stageCode: 'PROD',
    stageName: '生产阶段',
    sort: 20,
    description: '属于成衣主体制造阶段',
  },
  {
    stageCode: 'POST',
    stageName: '后道阶段',
    sort: 30,
    description: '属于成衣后整理与辅料安装阶段',
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
  > & {
    defaultDocument: string
    isGarmentManufacturing: boolean
  }
> = [
  {
    processCode: 'PRINT',
    processName: '印花',
    stageCode: 'PREP',
    sort: 10,
    isGarmentManufacturing: false,
    defaultDocument: '需求单',
    description: '由BOM上的印花要求触发',
    triggerSource: 'BOM上存在印花要求',
  },
  {
    processCode: 'DYE',
    processName: '染色',
    stageCode: 'PREP',
    sort: 20,
    isGarmentManufacturing: false,
    defaultDocument: '需求单',
    description: '由BOM上的染色要求触发',
    triggerSource: 'BOM上存在染色要求',
  },
  { processCode: 'CUT_PANEL', processName: '裁片', stageCode: 'PROD', sort: 10, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'EMBROIDERY', processName: '绣花', stageCode: 'PROD', sort: 20, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'PLEATING', processName: '压褶', stageCode: 'PROD', sort: 30, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'SEW', processName: '车缝', stageCode: 'PROD', sort: 40, isGarmentManufacturing: true, defaultDocument: '任务单' },
  {
    processCode: 'SPECIAL_CRAFT',
    processName: '特殊工艺',
    stageCode: 'PROD',
    sort: 50,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
    description: '用于打揽、打条、捆条、激光切、烫画、直喷等',
  },
  { processCode: 'SHRINKING', processName: '缩水', stageCode: 'PROD', sort: 60, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'WASHING', processName: '洗水', stageCode: 'POST', sort: 10, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'BUTTONHOLE', processName: '开扣眼', stageCode: 'POST', sort: 20, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'BUTTON_ATTACH', processName: '钉扣', stageCode: 'POST', sort: 30, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'HARDWARE', processName: '五金', stageCode: 'POST', sort: 40, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'FROG_BUTTON', processName: '盘扣', stageCode: 'POST', sort: 50, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'IRONING', processName: '熨烫', stageCode: 'POST', sort: 60, isGarmentManufacturing: true, defaultDocument: '任务单' },
  { processCode: 'PACKAGING', processName: '包装', stageCode: 'POST', sort: 70, isGarmentManufacturing: true, defaultDocument: '任务单' },
]

function resolveProcessGranularity(processCode: string): ProcessAssignmentGranularity {
  if (processCode === 'PRINT' || processCode === 'DYE') return 'COLOR'
  if (processCode === 'SEW' || processCode === 'IRONING' || processCode === 'PACKAGING') return 'SKU'
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

export const processDefinitions: ProcessDefinition[] = processDefinitionSeeds.map((seed) => {
  const defaultDocType = toProcessDocType(seed.defaultDocument)
  const isSpecialCraftContainer = seed.processCode === 'SPECIAL_CRAFT'
  const defaultRule = resolveProcessDefaultRule(seed.processCode)
  return {
    processCode: seed.processCode,
    systemProcessCode: PROCESS_SYSTEM_CODE_MAP[seed.processCode] ?? `PROC_${seed.processCode}`,
    processName: seed.processName,
    stageCode: seed.stageCode,
    sort: seed.sort,
    assignmentGranularity: defaultRule.assignmentGranularity,
    detailSplitMode: defaultRule.detailSplitMode,
    detailSplitDimensions: [...defaultRule.detailSplitDimensions],
    defaultDocType,
    taskTypeMode: isSpecialCraftContainer ? 'CRAFT' : 'PROCESS',
    isSpecialCraftContainer,
    description: seed.description,
    triggerSource: seed.triggerSource,
    defaultDocLabel: PROCESS_DOC_TYPE_LABEL[defaultDocType],
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
  { legacyValue: 128, legacyCraftName: '洗水', craftName: '洗水', processCode: 'WASHING', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 256, legacyCraftName: '手缝扣', craftName: '手缝扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 512, legacyCraftName: '机打扣', craftName: '机打扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 1024, legacyCraftName: '四爪扣', craftName: '四爪扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 2048, legacyCraftName: '鸡眼扣', craftName: '鸡眼扣', processCode: 'HARDWARE', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 4096, legacyCraftName: '缩水', craftName: '缩水', processCode: 'SHRINKING', isSpecialCraft: false, defaultDocument: '任务单', remark: '准备阶段只保留印花和染色，因此缩水归生产阶段' },
  { legacyValue: 8192, legacyCraftName: '烫画', craftName: '烫画', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '通常用于纯色T-shirt，已明确按特殊工艺生成任务单' },
  { legacyValue: 16384, legacyCraftName: '直喷', craftName: '直喷', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '通常用于纯色T-shirt，已明确按特殊工艺生成任务单' },
  { legacyValue: 32768, legacyCraftName: '布包扣', craftName: '布包扣', processCode: 'BUTTON_ATTACH', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 65536, legacyCraftName: '手工盘扣', craftName: '手工盘扣', processCode: 'FROG_BUTTON', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 131072, legacyCraftName: '捆条', craftName: '捆条', processCode: 'SPECIAL_CRAFT', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 262144, legacyCraftName: '曲牙', craftName: '曲牙', processCode: 'SEW', isSpecialCraft: false, defaultDocument: '任务单', remark: '当前先按车缝归类' },
  { legacyValue: 524288, legacyCraftName: '开扣眼', craftName: '开扣眼', processCode: 'BUTTONHOLE', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 1048576, legacyCraftName: '贝壳绣', craftName: '贝壳绣', processCode: 'EMBROIDERY', isSpecialCraft: false, defaultDocument: '任务单', remark: '当前先按绣花归类' },
]

const supplementalProcessCraftMappings: LegacyCraftMappingDefinition[] = [
  { legacyValue: 2000001, legacyCraftName: '丝网印', craftName: '丝网印', processCode: 'PRINT', isSpecialCraft: false, defaultDocument: '需求单' },
  { legacyValue: 2000002, legacyCraftName: '数码印', craftName: '数码印', processCode: 'PRINT', isSpecialCraft: false, defaultDocument: '需求单' },
  { legacyValue: 2000003, legacyCraftName: '匹染', craftName: '匹染', processCode: 'DYE', isSpecialCraft: false, defaultDocument: '需求单' },
  { legacyValue: 2000004, legacyCraftName: '色织', craftName: '色织', processCode: 'DYE', isSpecialCraft: false, defaultDocument: '需求单' },
  {
    legacyValue: 2000101,
    legacyCraftName: '印花工艺',
    craftName: '印花工艺',
    processCode: 'SPECIAL_CRAFT',
    isSpecialCraft: true,
    defaultDocument: '任务单',
    ruleSource: 'OVERRIDE_CRAFT',
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
    remark: '特殊工艺任务，使用工艺级覆盖规则',
  },
  {
    legacyValue: 2000102,
    legacyCraftName: '染色工艺',
    craftName: '染色工艺',
    processCode: 'SPECIAL_CRAFT',
    isSpecialCraft: true,
    defaultDocument: '任务单',
    ruleSource: 'OVERRIDE_CRAFT',
    assignmentGranularity: 'SKU',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
    remark: '特殊工艺任务，使用工艺级覆盖规则',
  },
  { legacyValue: 2000005, legacyCraftName: '熨烫', craftName: '熨烫', processCode: 'IRONING', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 2000006, legacyCraftName: '包装', craftName: '包装', processCode: 'PACKAGING', isSpecialCraft: false, defaultDocument: '任务单' },
]

const processDefinitionByCode = new Map(processDefinitions.map((item) => [item.processCode, item]))
const processDefinitionBySystemCode = new Map(processDefinitions.map((item) => [item.systemProcessCode, item]))
const stageDefinitionByCode = new Map(processStageDefinitions.map((item) => [item.stageCode, item]))

export const processCraftDefinitions: ProcessCraftDefinition[] = [...legacyProcessCraftMappings, ...supplementalProcessCraftMappings]
  .slice()
  .sort((a, b) => a.legacyValue - b.legacyValue)
  .map((item) => {
    const process = processDefinitionByCode.get(item.processCode)
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
      assignmentGranularity: resolvedAssignmentGranularity,
      ruleSource: resolvedRuleSource,
      defaultDocType,
      taskTypeMode: toTaskTypeMode(item.isSpecialCraft),
      detailSplitMode: resolvedDetailSplitMode,
      detailSplitDimensions: resolvedDetailSplitDimensions,
      isSpecialCraft: item.isSpecialCraft,
      carrySuggestion: CARRY_SUGGESTION_BY_PROCESS_CODE[item.processCode] ?? '工艺匹配工厂优先',
      remark: item.remark,
    }
  })

const processCraftByCode = new Map(processCraftDefinitions.map((item) => [item.craftCode, item]))
const processCraftByLegacyValue = new Map(processCraftDefinitions.map((item) => [item.legacyValue, item]))

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

export function listProcessesByStageCode(stageCode: CraftStageCode): ProcessDefinition[] {
  return listProcessDefinitions().filter((item) => item.stageCode === stageCode)
}

export function listProcessCraftDefinitions(): ProcessCraftDefinition[] {
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

export const processCraftDictRows: ProcessCraftDictRow[] = processCraftDefinitions.map((item) => {
  const process = processDefinitionByCode.get(item.processCode)
  const stage = stageDefinitionByCode.get(item.stageCode)
  const processAssignmentGranularity = process?.assignmentGranularity ?? 'ORDER'
  const processDetailSplitMode = process?.detailSplitMode ?? 'COMPOSITE'
  const processDetailSplitDimensions = [...(process?.detailSplitDimensions ?? ['PATTERN', 'MATERIAL_SKU'])]
  return {
    craftCode: item.craftCode,
    craftName: item.craftName,
    processCode: item.processCode,
    processName: process?.processName ?? item.processCode,
    stageCode: item.stageCode,
    stageName: stage?.stageName ?? item.stageCode,
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
  }
})

export function getProcessCraftDictRowByCode(craftCode: string): ProcessCraftDictRow | undefined {
  return processCraftDictRows.find((item) => item.craftCode === craftCode)
}
