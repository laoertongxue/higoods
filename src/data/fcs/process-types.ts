// 工艺字典兼容层
// 说明：统一真相源已收口到 process-craft-dict.ts；本文件保留旧调用方所需的查询接口。

import {
  getProcessDefinitionByCode,
  listProcessCraftDefinitions,
  listProcessDefinitions,
  type DetailSplitDimension,
  type DetailSplitMode,
  type ProcessAssignmentGranularity as DictProcessAssignmentGranularity,
  type RuleSource,
} from './process-craft-dict.ts'

export type ProcessStage = 'PREP' | 'CUTTING' | 'SEWING' | 'POST' | 'SPECIAL' | 'MATERIAL' | 'WAREHOUSE'
export type AssignmentMode = 'DIRECT' | 'BIDDING'
export type OwnerTier = 'ANY' | 'CENTRAL' | 'SATELLITE' | 'THIRD_PARTY'
export type ProcessAssignmentGranularity = DictProcessAssignmentGranularity

export interface ProcessType {
  code: string
  nameZh: string
  stage: ProcessStage
  assignmentGranularity: ProcessAssignmentGranularity
  canOutsource: boolean
  isExternalConstraint: boolean
  recommendedAssignmentMode: AssignmentMode
  recommendedOwnerTier: OwnerTier
  recommendedOwnerTypes: string[]
  defaultQcPoints: string[]
  defaultParamKeys: string[]
  processCode?: string
  defaultDocType?: 'DEMAND' | 'TASK'
  taskTypeMode?: 'PROCESS' | 'CRAFT'
  isSpecialCraft?: boolean
  ruleSource?: RuleSource
  detailSplitMode?: DetailSplitMode
  detailSplitDimensions?: DetailSplitDimension[]
}

export const stageLabels: Record<ProcessStage, string> = {
  PREP: '前道准备',
  CUTTING: '裁剪',
  SEWING: '车缝',
  POST: '后道',
  SPECIAL: '特种工艺',
  MATERIAL: '物料',
  WAREHOUSE: '仓储',
}

const processAssignmentGranularityOverrides: Partial<Record<string, ProcessAssignmentGranularity>> = {
  PROC_PRINT: 'COLOR',
  PROC_DYE: 'COLOR',
  PROC_SEW: 'SKU',
  PROC_IRON: 'SKU',
  PROC_PACK: 'SKU',
  PROC_QC: 'SKU',
  PROC_FINISHING: 'SKU',
}

function mapToLegacyStage(processCode: string, systemProcessCode: string, stageCode: 'PREP' | 'PROD' | 'POST'): ProcessStage {
  if (stageCode === 'PREP') return 'PREP'
  if (stageCode === 'POST') return 'POST'

  if (processCode === 'CUT_PANEL') return 'CUTTING'
  if (processCode === 'SPECIAL_CRAFT' || processCode === 'EMBROIDERY' || processCode === 'SHRINKING') {
    return 'SPECIAL'
  }
  if (systemProcessCode === 'PROC_PRINT' || systemProcessCode === 'PROC_DYE') return 'SPECIAL'
  return 'SEWING'
}

function getRecommendedOwnerTypes(stage: ProcessStage, processCode: string): string[] {
  if (processCode === 'PRINT' || processCode === 'DYE') return ['PRINTING', 'DYEING']
  if (stage === 'CUTTING') return ['CUTTING', 'SEWING']
  if (stage === 'POST') return ['FINISHING', 'WAREHOUSE']
  if (stage === 'SPECIAL') return ['SPECIAL_PROCESS', 'SEWING']
  if (stage === 'MATERIAL') return ['WAREHOUSE']
  if (stage === 'WAREHOUSE') return ['WAREHOUSE']
  return ['SEWING']
}

const processTypeMap = new Map<string, ProcessType>()

function upsertProcessType(item: ProcessType): void {
  processTypeMap.set(item.code, item)
}

for (const processDef of listProcessDefinitions()) {
  const stage = mapToLegacyStage(processDef.processCode, processDef.systemProcessCode, processDef.stageCode)
  const isExternalConstraint = processDef.processCode === 'PRINT' || processDef.processCode === 'DYE'
  upsertProcessType({
    code: processDef.systemProcessCode,
    nameZh: processDef.processName,
    stage,
    assignmentGranularity: processDef.assignmentGranularity,
    canOutsource: true,
    isExternalConstraint,
    recommendedAssignmentMode: isExternalConstraint ? 'BIDDING' : 'DIRECT',
    recommendedOwnerTier: isExternalConstraint ? 'THIRD_PARTY' : 'ANY',
    recommendedOwnerTypes: getRecommendedOwnerTypes(stage, processDef.processCode),
    defaultQcPoints: [],
    defaultParamKeys: [],
    processCode: processDef.processCode,
    defaultDocType: processDef.defaultDocType,
    taskTypeMode: processDef.taskTypeMode,
    isSpecialCraft: processDef.isSpecialCraftContainer,
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: processDef.detailSplitMode,
    detailSplitDimensions: [...processDef.detailSplitDimensions],
  })
}

for (const craftDef of listProcessCraftDefinitions()) {
  if (processTypeMap.has(craftDef.systemProcessCode)) continue

  const processDef = getProcessDefinitionByCode(craftDef.processCode)
  const stage = mapToLegacyStage(craftDef.processCode, craftDef.systemProcessCode, craftDef.stageCode)
  upsertProcessType({
    code: craftDef.systemProcessCode,
    nameZh: craftDef.craftName,
    stage,
    assignmentGranularity: craftDef.assignmentGranularity,
    canOutsource: true,
    isExternalConstraint: false,
    recommendedAssignmentMode: craftDef.isSpecialCraft ? 'BIDDING' : 'DIRECT',
    recommendedOwnerTier: craftDef.isSpecialCraft ? 'CENTRAL' : 'ANY',
    recommendedOwnerTypes: getRecommendedOwnerTypes(stage, craftDef.processCode),
    defaultQcPoints: [],
    defaultParamKeys: [],
    processCode: craftDef.processCode,
    defaultDocType: craftDef.defaultDocType,
    taskTypeMode: craftDef.taskTypeMode,
    isSpecialCraft: craftDef.isSpecialCraft,
    ruleSource: craftDef.ruleSource,
    detailSplitMode: craftDef.detailSplitMode,
    detailSplitDimensions: [...craftDef.detailSplitDimensions],
  })

  if (processDef && !processTypeMap.has(processDef.systemProcessCode)) {
    upsertProcessType({
      code: processDef.systemProcessCode,
      nameZh: processDef.processName,
      stage: mapToLegacyStage(processDef.processCode, processDef.systemProcessCode, processDef.stageCode),
      assignmentGranularity: processDef.assignmentGranularity,
      canOutsource: true,
      isExternalConstraint: false,
      recommendedAssignmentMode: 'DIRECT',
      recommendedOwnerTier: 'ANY',
      recommendedOwnerTypes: getRecommendedOwnerTypes(stage, processDef.processCode),
      defaultQcPoints: [],
      defaultParamKeys: [],
      processCode: processDef.processCode,
      defaultDocType: processDef.defaultDocType,
      taskTypeMode: processDef.taskTypeMode,
      isSpecialCraft: processDef.isSpecialCraftContainer,
      ruleSource: 'INHERIT_PROCESS',
      detailSplitMode: processDef.detailSplitMode,
      detailSplitDimensions: [...processDef.detailSplitDimensions],
    })
  }
}

const compatibilitySeeds: ProcessType[] = [
  {
    code: 'PROC_IRON',
    nameZh: '熨烫',
    stage: 'POST',
    assignmentGranularity: 'SKU',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['FINISHING', 'SEWING'],
    defaultQcPoints: [],
    defaultParamKeys: [],
    processCode: 'IRONING',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  {
    code: 'PROC_PACK',
    nameZh: '包装',
    stage: 'POST',
    assignmentGranularity: 'SKU',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['WAREHOUSE', 'FINISHING'],
    defaultQcPoints: [],
    defaultParamKeys: [],
    processCode: 'PACKAGING',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  {
    code: 'PROC_QC',
    nameZh: '质检',
    stage: 'POST',
    assignmentGranularity: 'SKU',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['FINISHING', 'WAREHOUSE'],
    defaultQcPoints: [],
    defaultParamKeys: [],
    processCode: 'POST',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  {
    code: 'PROC_FINISHING',
    nameZh: '后整理',
    stage: 'POST',
    assignmentGranularity: 'SKU',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['FINISHING', 'WAREHOUSE'],
    defaultQcPoints: [],
    defaultParamKeys: [],
    processCode: 'POST',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
  },
  {
    code: 'PROC_MATERIAL_PREP',
    nameZh: '物料准备',
    stage: 'MATERIAL',
    assignmentGranularity: 'ORDER',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['WAREHOUSE'],
    defaultQcPoints: [],
    defaultParamKeys: [],
    processCode: 'MATERIAL',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
  },
  {
    code: 'PROC_WAREHOUSE_IN',
    nameZh: '入库',
    stage: 'WAREHOUSE',
    assignmentGranularity: 'ORDER',
    canOutsource: false,
    isExternalConstraint: false,
    recommendedAssignmentMode: 'DIRECT',
    recommendedOwnerTier: 'ANY',
    recommendedOwnerTypes: ['WAREHOUSE'],
    defaultQcPoints: [],
    defaultParamKeys: [],
    processCode: 'WAREHOUSE',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
  },
]

for (const compatibilitySeed of compatibilitySeeds) {
  if (!processTypeMap.has(compatibilitySeed.code)) {
    upsertProcessType(compatibilitySeed)
  }
}

export const processTypes: ProcessType[] = Array.from(processTypeMap.values()).sort((a, b) =>
  a.code.localeCompare(b.code),
)

export function getProcessTypeByCode(code: string): ProcessType | undefined {
  return processTypeMap.get(code)
}

export function getProcessTypesByStage(stage: ProcessStage): ProcessType[] {
  return processTypes.filter((p) => p.stage === stage)
}

export function getAllProcessCodes(): string[] {
  return processTypes.map((p) => p.code)
}

export function getProcessAssignmentGranularity(code: string): ProcessAssignmentGranularity {
  const process = getProcessTypeByCode(code)
  if (!process) return processAssignmentGranularityOverrides[code] ?? 'ORDER'
  return process.assignmentGranularity
}

export function isSkuGranularityProcess(code: string): boolean {
  return getProcessAssignmentGranularity(code) === 'SKU'
}

export function isColorGranularityProcess(code: string): boolean {
  return getProcessAssignmentGranularity(code) === 'COLOR'
}
