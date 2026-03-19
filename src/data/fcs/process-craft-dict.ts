import {
  getProcessAssignmentGranularity,
  type ProcessAssignmentGranularity,
} from './process-types'

export type CraftStageCode = 'PREP' | 'PROD' | 'POST'

export type CraftStageDictItem = {
  stageCode: CraftStageCode
  stageName: string
  sort: number
  description: string
}

export type CraftProcessDictItem = {
  processCode: string
  processName: string
  stageCode: CraftStageCode
  stageName: string
  sort: number
  isGarmentManufacturing: boolean
  defaultDocument: string
  note?: string
  triggerSource?: string
}

export type LegacyCraftMappingItem = {
  legacyValue: number
  legacyCraftName: string
  craftName: string
  processCode: string
  processName: string
  stageCode: CraftStageCode
  stageName: string
  isSpecialCraft: boolean
  defaultDocument: string
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
  handoffAdvice: string
  legacyValue: number
  legacyCraftName: string
  isSpecialCraft: boolean
  defaultDocument: string
  remark?: string
  processNote?: string
  triggerSource?: string
}

const PROCESS_TO_RUNTIME_CODE: Record<string, string | undefined> = {
  PRINT: 'PROC_PRINT',
  DYE: 'PROC_DYE',
  CUT_PANEL: 'PROC_CUT',
  EMBROIDERY: 'PROC_EMBROIDER',
  PLEATING: 'PROC_PLEAT',
  SEW: 'PROC_SEW',
  SPECIAL_CRAFT: undefined,
  SHRINKING: 'PROC_SHRINK',
  WASHING: 'PROC_WASH',
  BUTTONHOLE: 'PROC_BUTTONHOLE',
  BUTTON_ATTACH: 'PROC_MACHINE_BUTTON',
  HARDWARE: 'PROC_EYELET',
  FROG_BUTTON: 'PROC_PANKOU',
}

const HANDOFF_ADVICE_BY_PROCESS: Record<string, string> = {
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
}

export const PROCESS_ASSIGNMENT_GRANULARITY_LABEL: Record<ProcessAssignmentGranularity, string> = {
  ORDER: '按生产单',
  COLOR: '按颜色',
  SKU: '按SKU',
}

export const craftStageDict: CraftStageDictItem[] = [
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

export const craftProcessDict: CraftProcessDictItem[] = [
  {
    processCode: 'PRINT',
    processName: '印花',
    stageCode: 'PREP',
    stageName: '准备阶段',
    sort: 10,
    isGarmentManufacturing: false,
    defaultDocument: '需求单',
    note: '由BOM上的印花要求触发',
    triggerSource: 'BOM上存在印花要求',
  },
  {
    processCode: 'DYE',
    processName: '染色',
    stageCode: 'PREP',
    stageName: '准备阶段',
    sort: 20,
    isGarmentManufacturing: false,
    defaultDocument: '需求单',
    note: '由BOM上的染色要求触发',
    triggerSource: 'BOM上存在染色要求',
  },
  {
    processCode: 'CUT_PANEL',
    processName: '裁片',
    stageCode: 'PROD',
    stageName: '生产阶段',
    sort: 10,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'EMBROIDERY',
    processName: '绣花',
    stageCode: 'PROD',
    stageName: '生产阶段',
    sort: 20,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'PLEATING',
    processName: '压褶',
    stageCode: 'PROD',
    stageName: '生产阶段',
    sort: 30,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'SEW',
    processName: '车缝',
    stageCode: 'PROD',
    stageName: '生产阶段',
    sort: 40,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'SPECIAL_CRAFT',
    processName: '特殊工艺',
    stageCode: 'PROD',
    stageName: '生产阶段',
    sort: 50,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
    note: '用于打揽、打条、捆条、激光切、烫画、直喷等',
  },
  {
    processCode: 'SHRINKING',
    processName: '缩水',
    stageCode: 'PROD',
    stageName: '生产阶段',
    sort: 60,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'WASHING',
    processName: '洗水',
    stageCode: 'POST',
    stageName: '后道阶段',
    sort: 10,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'BUTTONHOLE',
    processName: '开扣眼',
    stageCode: 'POST',
    stageName: '后道阶段',
    sort: 20,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'BUTTON_ATTACH',
    processName: '钉扣',
    stageCode: 'POST',
    stageName: '后道阶段',
    sort: 30,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'HARDWARE',
    processName: '五金',
    stageCode: 'POST',
    stageName: '后道阶段',
    sort: 40,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
  {
    processCode: 'FROG_BUTTON',
    processName: '盘扣',
    stageCode: 'POST',
    stageName: '后道阶段',
    sort: 50,
    isGarmentManufacturing: true,
    defaultDocument: '任务单',
  },
]

export const legacyProcessCraftMappings: LegacyCraftMappingItem[] = [
  { legacyValue: 1, legacyCraftName: '定位裁', craftName: '定位裁', processCode: 'CUT_PANEL', processName: '裁片', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 2, legacyCraftName: '绣花', craftName: '绣花', processCode: 'EMBROIDERY', processName: '绣花', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 4, legacyCraftName: '压褶', craftName: '压褶', processCode: 'PLEATING', processName: '压褶', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 8, legacyCraftName: '打揽', craftName: '打揽', processCode: 'SPECIAL_CRAFT', processName: '特殊工艺', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 16, legacyCraftName: '定向裁', craftName: '定向裁', processCode: 'CUT_PANEL', processName: '裁片', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 32, legacyCraftName: '打条', craftName: '打条', processCode: 'SPECIAL_CRAFT', processName: '特殊工艺', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 64, legacyCraftName: '激光切', craftName: '激光切', processCode: 'SPECIAL_CRAFT', processName: '特殊工艺', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 128, legacyCraftName: '洗水', craftName: '洗水', processCode: 'WASHING', processName: '洗水', stageCode: 'POST', stageName: '后道阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 256, legacyCraftName: '手缝扣', craftName: '手缝扣', processCode: 'BUTTON_ATTACH', processName: '钉扣', stageCode: 'POST', stageName: '后道阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 512, legacyCraftName: '机打扣', craftName: '机打扣', processCode: 'BUTTON_ATTACH', processName: '钉扣', stageCode: 'POST', stageName: '后道阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 1024, legacyCraftName: '四爪扣', craftName: '四爪扣', processCode: 'BUTTON_ATTACH', processName: '钉扣', stageCode: 'POST', stageName: '后道阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 2048, legacyCraftName: '鸡眼扣', craftName: '鸡眼扣', processCode: 'HARDWARE', processName: '五金', stageCode: 'POST', stageName: '后道阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 4096, legacyCraftName: '缩水', craftName: '缩水', processCode: 'SHRINKING', processName: '缩水', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: false, defaultDocument: '任务单', remark: '准备阶段只保留印花和染色，因此缩水归生产阶段' },
  { legacyValue: 8192, legacyCraftName: '烫画', craftName: '烫画', processCode: 'SPECIAL_CRAFT', processName: '特殊工艺', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: true, defaultDocument: '任务单', remark: '通常用于纯色T-shirt，已明确按特殊工艺生成任务单' },
  { legacyValue: 16384, legacyCraftName: '直喷', craftName: '直喷', processCode: 'SPECIAL_CRAFT', processName: '特殊工艺', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: true, defaultDocument: '任务单', remark: '通常用于纯色T-shirt，已明确按特殊工艺生成任务单' },
  { legacyValue: 32768, legacyCraftName: '布包扣', craftName: '布包扣', processCode: 'BUTTON_ATTACH', processName: '钉扣', stageCode: 'POST', stageName: '后道阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 65536, legacyCraftName: '手工盘扣', craftName: '手工盘扣', processCode: 'FROG_BUTTON', processName: '盘扣', stageCode: 'POST', stageName: '后道阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 131072, legacyCraftName: '捆条', craftName: '捆条', processCode: 'SPECIAL_CRAFT', processName: '特殊工艺', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: true, defaultDocument: '任务单', remark: '已明确按特殊工艺生成任务单' },
  { legacyValue: 262144, legacyCraftName: '曲牙', craftName: '曲牙', processCode: 'SEW', processName: '车缝', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: false, defaultDocument: '任务单', remark: '当前先按车缝归类' },
  { legacyValue: 524288, legacyCraftName: '开扣眼', craftName: '开扣眼', processCode: 'BUTTONHOLE', processName: '开扣眼', stageCode: 'POST', stageName: '后道阶段', isSpecialCraft: false, defaultDocument: '任务单' },
  { legacyValue: 1048576, legacyCraftName: '贝壳绣', craftName: '贝壳绣', processCode: 'EMBROIDERY', processName: '绣花', stageCode: 'PROD', stageName: '生产阶段', isSpecialCraft: false, defaultDocument: '任务单', remark: '当前先按绣花归类' },
]

function toCraftCode(legacyValue: number): string {
  return `CRAFT_${String(legacyValue).padStart(6, '0')}`
}

function resolveGranularity(processCode: string): ProcessAssignmentGranularity {
  const runtimeCode = PROCESS_TO_RUNTIME_CODE[processCode]
  if (runtimeCode) return getProcessAssignmentGranularity(runtimeCode)
  if (processCode === 'PRINT' || processCode === 'DYE') return 'COLOR'
  return 'ORDER'
}

function resolveHandoffAdvice(processCode: string): string {
  return HANDOFF_ADVICE_BY_PROCESS[processCode] ?? '工艺匹配工厂优先'
}

export const processCraftDictRows: ProcessCraftDictRow[] = legacyProcessCraftMappings
  .slice()
  .sort((a, b) => a.legacyValue - b.legacyValue)
  .map((item) => {
    const process = craftProcessDict.find((entry) => entry.processCode === item.processCode)
    const assignmentGranularity = resolveGranularity(item.processCode)
    return {
      craftCode: toCraftCode(item.legacyValue),
      craftName: item.craftName,
      processCode: item.processCode,
      processName: item.processName,
      stageCode: item.stageCode,
      stageName: item.stageName,
      assignmentGranularity,
      assignmentGranularityLabel: PROCESS_ASSIGNMENT_GRANULARITY_LABEL[assignmentGranularity],
      handoffAdvice: resolveHandoffAdvice(item.processCode),
      legacyValue: item.legacyValue,
      legacyCraftName: item.legacyCraftName,
      isSpecialCraft: item.isSpecialCraft,
      defaultDocument: item.defaultDocument,
      remark: item.remark,
      processNote: process?.note,
      triggerSource: process?.triggerSource,
    }
  })

export function getProcessCraftDictRowByCode(craftCode: string): ProcessCraftDictRow | undefined {
  return processCraftDictRows.find((item) => item.craftCode === craftCode)
}
