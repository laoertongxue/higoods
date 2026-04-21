import { appStore } from '../../state/store.ts'
import { escapeHtml } from '../../utils.ts'
import {
  TECH_PACK_PATTERN_CATEGORY_OPTIONS,
  TECH_PACK_PATTERN_MATERIAL_TYPE_LABELS,
  TECH_PACK_PATTERN_PARSE_STATUS_LABELS,
  type TechPack,
  type TechPackSkuLine,
  type TechPackAssignmentGranularity,
  type TechPackColorMappingGeneratedMode,
  type TechPackColorMappingStatus,
  type TechPackColorMaterialMapping,
  type TechPackColorMaterialMappingLine,
  type TechPackPatternCategory,
  type TechPackPatternFileMode,
  type TechPackPatternMaterialType,
  type TechPackPatternParseStatus,
  type TechPackPatternPieceRow,
  type TechPackPatternPieceSourceType,
  type TechPackProcessEntry,
  type TechPackProcessEntryType,
  type TechPackRuleSource,
  type TechPackDetailSplitMode,
  type TechPackDetailSplitDimension,
  type TechPackSizeRow,
  resolveTechPackProcessEntryRule,
} from '../../data/fcs/tech-packs.ts'
import { buildLegacyTechPackFromTechnicalVersion, buildTechnicalContentPatchFromLegacyTechPack } from '../../data/pcs-technical-data-fcs-adapter.ts'
import { saveTechnicalDataVersionContent } from '../../data/pcs-project-technical-data-writeback.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
} from '../../data/pcs-technical-data-version-repository.ts'
import {
  DETAIL_SPLIT_DIMENSION_LABEL,
  DETAIL_SPLIT_MODE_LABEL,
  PUBLISHED_SAM_UNIT_LABEL,
  PROCESS_ASSIGNMENT_GRANULARITY_LABEL,
  PROCESS_DOC_TYPE_LABEL,
  RULE_SOURCE_LABEL,
  TASK_TYPE_MODE_LABEL,
  getProcessCraftByCode,
  getProcessDefinitionByCode,
  listProcessCraftDefinitions,
  listProcessDefinitions,
  listProcessesByStageCode,
  listProcessStages,
} from '../../data/fcs/process-craft-dict.ts'
import { productionOrders } from '../../data/fcs/production-orders.ts'

type TechPackTab =
  | 'pattern'
  | 'bom'
  | 'process'
  | 'color-mapping'
  | 'size'
  | 'quality'
  | 'design'
  | 'attachments'
  | 'cost'
type DifficultyLevel = 'LOW' | 'MEDIUM' | 'HIGH'

type QualityRuleRow = {
  id: string
  checkItem: string
  standardText: string
  samplingRule: string
  note: string
}

type TechniqueItem = {
  id: string
  entryType: TechPackProcessEntryType
  stageCode: 'PREP' | 'PROD' | 'POST'
  stage: string
  processCode: string
  process: string
  craftCode: string
  technique: string
  assignmentGranularity: TechPackAssignmentGranularity
  ruleSource: TechPackRuleSource
  detailSplitMode: TechPackDetailSplitMode
  detailSplitDimensions: TechPackDetailSplitDimension[]
  defaultDocType: 'DEMAND' | 'TASK'
  taskTypeMode: 'PROCESS' | 'CRAFT'
  isSpecialCraft: boolean
  triggerSource: string
  standardTime: number
  timeUnit: string
  referencePublishedSamValue: number | null
  referencePublishedSamUnit: string
  referencePublishedSamUnitLabel: string
  referencePublishedSamNote: string
  difficulty: '简单' | '中等' | '困难'
  remark: string
  source: '字典引用'
}

type BaselineProcessOption = {
  processCode: string
  processName: string
  stageCode: 'PREP' | 'PROD' | 'POST'
  stageName: string
  assignmentGranularity: TechPackAssignmentGranularity
  ruleSource: TechPackRuleSource
  detailSplitMode: TechPackDetailSplitMode
  detailSplitDimensions: TechPackDetailSplitDimension[]
  defaultDocType: 'DEMAND' | 'TASK'
  taskTypeMode: 'PROCESS' | 'CRAFT'
  triggerSource: string
}

type CraftOption = {
  craftCode: string
  craftName: string
  processCode: string
  processName: string
  stageCode: 'PREP' | 'PROD' | 'POST'
  stageName: string
  assignmentGranularity: TechPackAssignmentGranularity
  ruleSource: TechPackRuleSource
  detailSplitMode: TechPackDetailSplitMode
  detailSplitDimensions: TechPackDetailSplitDimension[]
  defaultDocType: 'DEMAND' | 'TASK'
  taskTypeMode: 'PROCESS' | 'CRAFT'
  isSpecialCraft: boolean
  referencePublishedSamValue: number
  referencePublishedSamUnit: string
  referencePublishedSamUnitLabel: string
  referencePublishedSamNote: string
}

type BomItemRow = {
  id: string
  type: string
  colorLabel: string
  materialCode: string
  materialName: string
  spec: string
  patternPieces: string[]
  linkedPatternIds: string[]
  applicableSkuCodes: string[]
  usageProcessCodes: string[]
  usage: number
  lossRate: number
  printRequirement: string
  dyeRequirement: string
}

type PatternPieceRow = {
  id: string
  name: string
  count: number
  note: string
  applicableSkuCodes: string[]
  sourceType: TechPackPatternPieceSourceType
  sourcePartName?: string
  systemPieceName?: string
  candidatePartNames?: string[]
  sizeCode?: string
  quantityText?: string
  annotation?: string
  category?: string
  width?: number
  height?: number
  area?: number
  perimeter?: number
  geometryHash?: string
  previewSvg?: string
  parserStatus?: '解析成功' | '待人工矫正' | '解析异常'
  machineReadyStatus?: '可模板机处理' | '待评估' | '不适用'
  rawTextLabels?: string[]
  missingName?: boolean
  missingCount?: boolean
}

type SkuOption = {
  skuCode: string
  color: string
  size: string
}

type PatternItem = {
  id: string
  name: string
  type: TechPackPatternCategory | string
  image: string
  file: string
  remark: string
  linkedBomItemId: string
  widthCm: number
  markerLengthM: number
  totalPieceCount: number
  patternMaterialType: TechPackPatternMaterialType
  patternMaterialTypeLabel: string
  patternFileMode: TechPackPatternFileMode
  parseStatus: TechPackPatternParseStatus
  parseStatusLabel: string
  parseError: string
  parsedAt: string
  dxfFileName: string
  dxfFileSize: number
  dxfLastModified: string
  rulFileName: string
  rulFileSize: number
  rulLastModified: string
  singlePatternFileName: string
  singlePatternFileSize: number
  singlePatternFileLastModified: string
  dxfEncoding: string
  rulEncoding: string
  rulSizeList: string[]
  rulSampleSize: string
  patternSoftwareName: string
  sizeRange: string
  pieceRows: PatternPieceRow[]
}

type PatternFormState = Omit<PatternItem, 'id'> & {
  selectedDxfFile: File | null
  selectedRulFile: File | null
  selectedSinglePatternFile: File | null
  patternParsing: boolean
}

type ColorMaterialMappingLineRow = {
  id: string
  bomItemId: string
  materialCode: string
  materialName: string
  materialType: string
  patternId: string
  patternName: string
  pieceId: string
  pieceName: string
  pieceCountPerUnit: number
  unit: string
  applicableSkuCodes: string[]
  sourceMode: TechPackColorMappingGeneratedMode
  note: string
}

type ColorMaterialMappingRow = {
  id: string
  spuCode: string
  colorCode: string
  colorName: string
  status: TechPackColorMappingStatus
  generatedMode: TechPackColorMappingGeneratedMode
  confirmedBy: string
  confirmedAt: string
  remark: string
  lines: ColorMaterialMappingLineRow[]
}

type MaterialCostRow = {
  id: string
  materialName: string
  spec: string
  usage: number
  price: string
  currency: string
  unit: string
}

type ProcessCostRow = {
  id: string
  stage: string
  process: string
  technique: string
  price: string
  currency: string
  unit: string
}

type CustomCostRow = {
  id: string
  name: string
  price: string
  currency: string
  unit: string
  remark: string
}

type ChecklistItem = {
  key: string
  label: string
  required: boolean
  done: boolean
}

const currentUser = {
  id: 'U001',
  name: 'Budi Santoso',
  role: 'ADMIN' as const,
}

const techPackStatusConfig: Record<string, { label: string; className: string }> = {
  MISSING: { label: '缺失', className: 'bg-red-100 text-red-700' },
  BETA: { label: '草稿中', className: 'bg-yellow-100 text-yellow-700' },
  RELEASED: { label: '已发布待启用', className: 'bg-green-100 text-green-700' },
}

const tabItems: Array<{ key: TechPackTab; icon: string; label: string }> = [
  { key: 'bom', icon: 'clipboard-list', label: '物料清单' },
  { key: 'pattern', icon: 'file-text', label: '纸样管理' },
  { key: 'process', icon: 'scissors', label: '工序工艺' },
  { key: 'size', icon: 'ruler', label: '放码规则' },
  { key: 'quality', icon: 'shield-check', label: '质检标准' },
  { key: 'color-mapping', icon: 'git-merge', label: '款色用料对应' },
  { key: 'design', icon: 'image', label: '花型设计' },
  { key: 'attachments', icon: 'paperclip', label: '附件' },
]

const printOptions = ['无', '数码印', '丝网印', '胶浆印', '烫金', '烫银', '转印', '其他']
const dyeOptions = ['无', '匹染', '成衣染', '扎染', '渐变染', '其他']

function requestTechPackRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('higood:request-render'))
  }
}

function normalizePatternMaterialType(
  value: string | null | undefined,
): TechPackPatternMaterialType {
  if (value === 'WOVEN' || value === 'KNIT' || value === 'UNKNOWN') return value
  return 'UNKNOWN'
}

function getPatternMaterialTypeLabel(value: TechPackPatternMaterialType): string {
  return TECH_PACK_PATTERN_MATERIAL_TYPE_LABELS[value] || '暂无数据'
}

function normalizePatternParseStatus(
  value: string | null | undefined,
): TechPackPatternParseStatus {
  if (
    value === 'NOT_PARSED'
    || value === 'PARSING'
    || value === 'PARSED'
    || value === 'FAILED'
    || value === 'NOT_REQUIRED'
  ) {
    return value
  }
  return 'NOT_PARSED'
}

function getPatternParseStatusLabel(value: TechPackPatternParseStatus): string {
  return TECH_PACK_PATTERN_PARSE_STATUS_LABELS[value] || '待解析'
}

function inferPatternMaterialTypeFromPatternFile(input: {
  fileName?: string
  singlePatternFileName?: string
  dxfFileName?: string
  linkedBomItemId?: string
  linkedBomName?: string
  linkedBomSpec?: string
  linkedBomType?: string
}): TechPackPatternMaterialType {
  const haystack = [
    input.fileName,
    input.singlePatternFileName,
    input.dxfFileName,
    input.linkedBomName,
    input.linkedBomSpec,
    input.linkedBomType,
  ]
    .map((item) => String(item || '').trim().toLowerCase())
    .join(' ')

  if (haystack.includes('针织') || haystack.includes('knit')) return 'KNIT'
  if (haystack.includes('布料') || haystack.includes('梭织') || haystack.includes('woven')) return 'WOVEN'
  return 'UNKNOWN'
}

function inferPatternFileMode(materialType: TechPackPatternMaterialType): TechPackPatternFileMode {
  return materialType === 'WOVEN' ? 'PAIRED_DXF_RUL' : 'SINGLE_FILE'
}

function createEmptyPatternFormState(): PatternFormState {
  const patternMaterialType: TechPackPatternMaterialType = 'UNKNOWN'
  const parseStatus: TechPackPatternParseStatus = 'NOT_PARSED'
  return {
    name: '',
    type: '主体片',
    image: '',
    file: '',
    remark: '',
    linkedBomItemId: '',
    widthCm: 0,
    markerLengthM: 0,
    totalPieceCount: 0,
    patternMaterialType,
    patternMaterialTypeLabel: getPatternMaterialTypeLabel(patternMaterialType),
    patternFileMode: inferPatternFileMode(patternMaterialType),
    parseStatus,
    parseStatusLabel: getPatternParseStatusLabel(parseStatus),
    parseError: '',
    parsedAt: '',
    dxfFileName: '',
    dxfFileSize: 0,
    dxfLastModified: '',
    rulFileName: '',
    rulFileSize: 0,
    rulLastModified: '',
    singlePatternFileName: '',
    singlePatternFileSize: 0,
    singlePatternFileLastModified: '',
    dxfEncoding: '',
    rulEncoding: '',
    rulSizeList: [],
    rulSampleSize: '',
    patternSoftwareName: '',
    sizeRange: '',
    pieceRows: [],
    selectedDxfFile: null,
    selectedRulFile: null,
    selectedSinglePatternFile: null,
    patternParsing: false,
  }
}
const currencyOptions = ['人民币', '美元', '印尼盾']
const materialUnitOptions = ['人民币/米', '人民币/码', '人民币/件', '美元/米', '美元/件', '印尼盾/件']
const processUnitOptions = ['人民币/件', '人民币/批', '美元/件', '美元/批', '印尼盾/件', '印尼盾/批']
const customCostUnitOptions = ['人民币/件', '人民币/批', '人民币/项', '美元/项', '印尼盾/项']
const bomUsageProcessOptions = [
  { code: 'PROC_CUT', label: '裁片' },
  { code: 'PROC_PRINT', label: '印花' },
  { code: 'PROC_DYE', label: '染色' },
  { code: 'PROC_SEW', label: '车缝' },
  { code: 'PROC_IRON', label: '后道' },
  { code: 'PROC_PACK', label: '包装' },
]
const difficultyOptions: Array<TechniqueItem['difficulty']> = ['简单', '中等', '困难']
const stageCodeToName = new Map(listProcessStages().map((item) => [item.stageCode, item.stageName]))
const stageOptions = listProcessStages()
  .slice()
  .sort((a, b) => a.sort - b.sort)
  .map((item) => item.stageName)
const stageNameToCode = new Map(listProcessStages().map((item) => [item.stageName, item.stageCode]))
const prepDemandProcessCodes = ['PRINT', 'DYE'] as const
type PrepDemandProcessCode = (typeof prepDemandProcessCodes)[number]

const baselineProcessOptions: BaselineProcessOption[] = listProcessDefinitions()
  .filter((item) => item.stageCode === 'PREP')
  .map((item) => ({
    processCode: item.processCode,
    processName: item.processName,
    stageCode: item.stageCode,
    stageName: stageCodeToName.get(item.stageCode) || item.stageCode,
    assignmentGranularity: item.assignmentGranularity,
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: item.detailSplitMode,
    detailSplitDimensions: [...item.detailSplitDimensions],
    defaultDocType: item.defaultDocType,
    taskTypeMode: item.taskTypeMode,
    triggerSource: item.triggerSource || '',
  }))

const craftOptions: CraftOption[] = listProcessCraftDefinitions()
  .map((item) => {
    const processDef = getProcessDefinitionByCode(item.processCode)
    return {
      craftCode: item.craftCode,
      craftName: item.craftName,
      processCode: item.processCode,
      processName: processDef?.processName || item.processCode,
      stageCode: item.stageCode,
      stageName: stageCodeToName.get(item.stageCode) || item.stageCode,
      assignmentGranularity: item.assignmentGranularity,
      ruleSource: item.ruleSource,
      detailSplitMode: item.detailSplitMode,
      detailSplitDimensions: [...item.detailSplitDimensions],
      defaultDocType: item.defaultDocType,
      taskTypeMode: item.taskTypeMode,
      isSpecialCraft: item.isSpecialCraft,
      referencePublishedSamValue: item.referencePublishedSamValue,
      referencePublishedSamUnit: item.referencePublishedSamUnit,
      referencePublishedSamUnitLabel: PUBLISHED_SAM_UNIT_LABEL[item.referencePublishedSamUnit],
      referencePublishedSamNote: item.referencePublishedSamNote,
    }
  })
  .sort((a, b) => a.craftName.localeCompare(b.craftName, 'zh-Hans-CN'))

const DEFAULT_PATTERN_ITEMS: PatternItem[] = [
  {
    id: 'PAT-001',
    name: '前片',
    type: '主体片',
    image: 'pattern-front.png',
    file: 'front.dxf',
    remark: '标准前片',
    linkedBomItemId: 'bom-1',
    widthCm: 142,
    markerLengthM: 2.62,
    totalPieceCount: 6,
    patternMaterialType: 'KNIT',
    patternMaterialTypeLabel: getPatternMaterialTypeLabel('KNIT'),
    patternFileMode: 'SINGLE_FILE',
    parseStatus: 'NOT_REQUIRED',
    parseStatusLabel: getPatternParseStatusLabel('NOT_REQUIRED'),
    parseError: '',
    parsedAt: '',
    dxfFileName: '',
    dxfFileSize: 0,
    dxfLastModified: '',
    rulFileName: '',
    rulFileSize: 0,
    rulLastModified: '',
    singlePatternFileName: 'front.dxf',
    singlePatternFileSize: 0,
    singlePatternFileLastModified: '',
    dxfEncoding: '',
    rulEncoding: '',
    rulSizeList: [],
    rulSampleSize: '',
    patternSoftwareName: '',
    sizeRange: '',
    pieceRows: [
      { id: 'PAT-001-R1', name: '前片', count: 2, note: '', applicableSkuCodes: [], sourceType: 'MANUAL' },
      { id: 'PAT-001-R2', name: '门襟', count: 2, note: '', applicableSkuCodes: [], sourceType: 'MANUAL' },
      { id: 'PAT-001-R3', name: '口袋贴', count: 2, note: '可选口袋款', applicableSkuCodes: [], sourceType: 'MANUAL' },
    ],
  },
  {
    id: 'PAT-002',
    name: '后片',
    type: '主体片',
    image: 'pattern-back.png',
    file: 'back.dxf',
    remark: '标准后片',
    linkedBomItemId: 'bom-1',
    widthCm: 142,
    markerLengthM: 2.2,
    totalPieceCount: 4,
    patternMaterialType: 'KNIT',
    patternMaterialTypeLabel: getPatternMaterialTypeLabel('KNIT'),
    patternFileMode: 'SINGLE_FILE',
    parseStatus: 'NOT_REQUIRED',
    parseStatusLabel: getPatternParseStatusLabel('NOT_REQUIRED'),
    parseError: '',
    parsedAt: '',
    dxfFileName: '',
    dxfFileSize: 0,
    dxfLastModified: '',
    rulFileName: '',
    rulFileSize: 0,
    rulLastModified: '',
    singlePatternFileName: 'back.dxf',
    singlePatternFileSize: 0,
    singlePatternFileLastModified: '',
    dxfEncoding: '',
    rulEncoding: '',
    rulSizeList: [],
    rulSampleSize: '',
    patternSoftwareName: '',
    sizeRange: '',
    pieceRows: [
      { id: 'PAT-002-R1', name: '后片', count: 2, note: '', applicableSkuCodes: [], sourceType: 'MANUAL' },
      { id: 'PAT-002-R2', name: '肩部补强片', count: 2, note: '', applicableSkuCodes: [], sourceType: 'MANUAL' },
    ],
  },
]

const DEFAULT_BOM_ITEMS: BomItemRow[] = [
  {
    id: 'bom-1',
    type: '面料',
    colorLabel: 'White',
    materialCode: 'FAB-001',
    materialName: '纯棉针织布',
    spec: '180g/m²',
    patternPieces: ['前片', '后片', '袖片'],
    linkedPatternIds: ['PAT-001', 'PAT-002'],
    applicableSkuCodes: [],
    usageProcessCodes: ['PROC_CUT'],
    usage: 0.8,
    lossRate: 3,
    printRequirement: '数码印',
    dyeRequirement: '无',
  },
  {
    id: 'bom-2',
    type: '面料',
    colorLabel: 'White',
    materialCode: 'FAB-002',
    materialName: '弹力罗纹',
    spec: '200g/m²',
    patternPieces: ['领片'],
    linkedPatternIds: [],
    applicableSkuCodes: [],
    usageProcessCodes: ['PROC_CUT', 'PROC_SEW'],
    usage: 0.1,
    lossRate: 5,
    printRequirement: '无',
    dyeRequirement: '匹染',
  },
  {
    id: 'bom-3',
    type: '辅料',
    colorLabel: '全部SKU（当前未区分颜色）',
    materialCode: 'ACC-001',
    materialName: '纽扣',
    spec: '15mm圆形',
    patternPieces: ['前片'],
    linkedPatternIds: [],
    applicableSkuCodes: [],
    usageProcessCodes: ['PROC_PACK'],
    usage: 5,
    lossRate: 2,
    printRequirement: '无',
    dyeRequirement: '无',
  },
]

const DEFAULT_TECHNIQUES: TechniqueItem[] = [
  {
    id: 'tech-default-1',
    entryType: 'PROCESS_BASELINE',
    stageCode: 'PREP',
    stage: '准备阶段',
    processCode: 'PRINT',
    process: '印花',
    craftCode: '',
    technique: '印花',
    assignmentGranularity: 'COLOR',
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
    defaultDocType: 'DEMAND',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    triggerSource: 'BOM上存在印花要求',
    standardTime: 10,
    timeUnit: '分钟/件',
    referencePublishedSamValue: null,
    referencePublishedSamUnit: '',
    referencePublishedSamUnitLabel: '',
    referencePublishedSamNote: '当前为工序级准备项，如需锁定具体参考值与推荐单位，请在当前款下选择具体工艺。',
    difficulty: '中等',
    remark: '',
    source: '字典引用',
  },
  {
    id: 'tech-default-2',
    entryType: 'CRAFT',
    stageCode: 'PROD',
    stage: '生产阶段',
    processCode: 'CUT_PANEL',
    process: '裁片',
    craftCode: 'CRAFT_000001',
    technique: '定位裁',
    assignmentGranularity: 'ORDER',
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_COLOR', 'PATTERN', 'MATERIAL_SKU'],
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    triggerSource: '',
    standardTime: 6,
    timeUnit: '分钟/件',
    referencePublishedSamValue: 0.6,
    referencePublishedSamUnit: 'MINUTE_PER_PIECE',
    referencePublishedSamUnitLabel: '分钟/件',
    referencePublishedSamNote: '平台理论参考值，适用于普通复杂度；技术包版本可结合款式结构和加工难度调整当前款发布工时 SAM 基线。',
    difficulty: '简单',
    remark: '',
    source: '字典引用',
  },
  {
    id: 'tech-default-3',
    entryType: 'CRAFT',
    stageCode: 'PROD',
    stage: '生产阶段',
    processCode: 'SEW',
    process: '车缝',
    craftCode: 'CRAFT_262144',
    technique: '曲牙',
    assignmentGranularity: 'SKU',
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['GARMENT_SKU'],
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    triggerSource: '',
    standardTime: 12,
    timeUnit: '分钟/件',
    referencePublishedSamValue: 1.4,
    referencePublishedSamUnit: 'MINUTE_PER_PIECE',
    referencePublishedSamUnitLabel: '分钟/件',
    referencePublishedSamNote: '平台理论参考值，适用于普通复杂度；技术包版本可结合款式结构和加工难度调整当前款发布工时 SAM 基线。',
    difficulty: '中等',
    remark: '',
    source: '字典引用',
  },
]

interface TechPackPageState {
  currentSpuCode: string | null
  currentStyleId: string | null
  currentTechnicalVersionId: string | null
  currentTechnicalVersionCode: string | null
  loading: boolean
  activeTab: TechPackTab
  techPack: TechPack | null
  compatibilityMode: boolean
  compatibilityMessage: string
  compatibilitySourceKind: 'pcs_published' | 'fcs_legacy' | 'missing' | null
  compatibilityMaintenancePath: string
  compatibilityMaintenanceTitle: string
  compatibilitySourceNote: string
  compatibilitySourceNoteOpen: boolean

  patternItems: PatternItem[]
  bomItems: BomItemRow[]
  techniques: TechniqueItem[]
  qualityRules: QualityRuleRow[]
  materialCostRows: MaterialCostRow[]
  processCostRows: ProcessCostRow[]
  customCostRows: CustomCostRow[]
  colorMaterialMappings: ColorMaterialMappingRow[]

  releaseDialogOpen: boolean
  addPatternDialogOpen: boolean
  addBomDialogOpen: boolean
  addTechniqueDialogOpen: boolean
  addSizeDialogOpen: boolean
  addQualityDialogOpen: boolean
  addDesignDialogOpen: boolean
  addAttachmentDialogOpen: boolean
  patternDialogOpen: boolean

  selectedPattern: string | null

  editPatternItemId: string | null
  editBomItemId: string | null
  editTechniqueId: string | null
  newPattern: PatternFormState
  newBomItem: {
    type: string
    colorLabel: string
    materialCode: string
    materialName: string
    spec: string
    patternPieces: string[]
    linkedPatternIds: string[]
    applicableSkuCodes: string[]
    usageProcessCodes: string[]
    usage: string
    lossRate: string
    printRequirement: string
    dyeRequirement: string
  }
  newTechnique: {
    stageCode: '' | 'PREP' | 'PROD' | 'POST'
    processCode: string
    entryType: TechPackProcessEntryType
    baselineProcessCode: string
    craftCode: string
    ruleSource: TechPackRuleSource
    assignmentGranularity: TechPackAssignmentGranularity
    detailSplitMode: TechPackDetailSplitMode
    detailSplitDimensions: TechPackDetailSplitDimension[]
    standardTime: string
    timeUnit: string
    difficulty: TechniqueItem['difficulty']
    remark: string
  }
  newSizeRow: {
    part: string
    S: string
    M: string
    L: string
    XL: string
    tolerance: string
  }
  newQualityRule: {
    checkItem: string
    standardText: string
    samplingRule: string
    note: string
  }
  newDesignName: string
  newAttachment: {
    fileName: string
    fileType: string
    fileSize: string
  }
}

const state: TechPackPageState = {
  currentSpuCode: null,
  currentStyleId: null,
  currentTechnicalVersionId: null,
  currentTechnicalVersionCode: null,
  loading: true,
  activeTab: 'pattern',
  techPack: null,
  compatibilityMode: false,
  compatibilityMessage: '',
  compatibilitySourceKind: null,
  compatibilityMaintenancePath: '',
  compatibilityMaintenanceTitle: '',
  compatibilitySourceNote: '',
  compatibilitySourceNoteOpen: false,

  patternItems: [],
  bomItems: [],
  techniques: [],
  qualityRules: [],
  materialCostRows: [],
  processCostRows: [],
  customCostRows: [],
  colorMaterialMappings: [],

  releaseDialogOpen: false,
  addPatternDialogOpen: false,
  addBomDialogOpen: false,
  addTechniqueDialogOpen: false,
  addSizeDialogOpen: false,
  addQualityDialogOpen: false,
  addDesignDialogOpen: false,
  addAttachmentDialogOpen: false,
  patternDialogOpen: false,

  selectedPattern: null,

  editPatternItemId: null,
  editBomItemId: null,
  editTechniqueId: null,
  newPattern: createEmptyPatternFormState(),
  newBomItem: {
    type: '面料',
    colorLabel: '',
    materialCode: '',
    materialName: '',
    spec: '',
    patternPieces: [],
    linkedPatternIds: [],
    applicableSkuCodes: [],
    usageProcessCodes: [],
    usage: '',
    lossRate: '',
    printRequirement: '无',
    dyeRequirement: '无',
  },
  newTechnique: {
    stageCode: '',
    processCode: '',
    entryType: 'CRAFT',
    baselineProcessCode: '',
    craftCode: '',
    ruleSource: 'INHERIT_PROCESS',
    assignmentGranularity: 'ORDER',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
    standardTime: '',
    timeUnit: '分钟/件',
    difficulty: '中等',
    remark: '',
  },
  newSizeRow: {
    part: '',
    S: '',
    M: '',
    L: '',
    XL: '',
    tolerance: '',
  },
  newQualityRule: {
    checkItem: '',
    standardText: '',
    samplingRule: '',
    note: '',
  },
  newDesignName: '',
  newAttachment: {
    fileName: '',
    fileType: 'PDF',
    fileSize: '1.0MB',
  },
}

type TechPackPageInitSeed = {
  spuName?: string
  skuCatalog?: TechPackSkuLine[]
  activeTab?: TechPackTab
  styleId?: string
  technicalVersionId?: string
  compatibilityMode?: boolean
}

function toTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function decodeSpuCode(rawSpuCode: string): string {
  try {
    return decodeURIComponent(rawSpuCode)
  } catch {
    return rawSpuCode
  }
}

function cloneQualityRules(rows: QualityRuleRow[]): QualityRuleRow[] {
  return rows.map((item) => ({ ...item }))
}

function resetQualityForm(): void {
  state.newQualityRule = {
    checkItem: '',
    standardText: '',
    samplingRule: '',
    note: '',
  }
}

function cloneTechPack(techPack: TechPack): TechPack {
  return {
    ...techPack,
    patternFiles: techPack.patternFiles.map((item) => ({
      ...item,
      pieceRows: (item.pieceRows ?? []).map((row) => ({
        ...row,
        applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      })),
    })),
    processes: techPack.processes.map((item) => ({ ...item })),
    processEntries: (techPack.processEntries ?? []).map((item) => ({
      ...item,
      detailSplitDimensions: [...(item.detailSplitDimensions ?? [])],
    })),
    sizeTable: techPack.sizeTable.map((item) => ({ ...item })),
    bomItems: techPack.bomItems.map((item) => ({
      ...item,
      applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
      linkedPatternIds: [...(item.linkedPatternIds ?? [])],
      usageProcessCodes: [...(item.usageProcessCodes ?? [])],
    })),
    skuCatalog: (techPack.skuCatalog ?? []).map((item) => ({ ...item })),
    materialCostItems: (techPack.materialCostItems ?? []).map((item) => ({ ...item })),
    processCostItems: (techPack.processCostItems ?? []).map((item) => ({ ...item })),
    customCostItems: (techPack.customCostItems ?? []).map((item) => ({ ...item })),
    colorMaterialMappings: (techPack.colorMaterialMappings ?? []).map((item) => ({
      ...item,
      lines: item.lines.map((line) => ({
        ...line,
        applicableSkuCodes: [...(line.applicableSkuCodes ?? [])],
      })),
    })),
    patternDesigns: techPack.patternDesigns.map((item) => ({ ...item })),
    attachments: techPack.attachments.map((item) => ({ ...item })),
    missingChecklist: [...techPack.missingChecklist],
  }
}

function applyTechPackState(
  techPack: TechPack,
  options: TechPackPageInitSeed & {
    currentSpuCode: string
    styleId: string
    technicalVersionId: string
    technicalVersionCode: string
    qualityRules: QualityRuleRow[]
  },
): void {
  const normalizedSeedSkuCatalog = options.skuCatalog
    ? normalizeSeedSkuCatalog(options.skuCatalog)
    : undefined
  const nextTechPack = cloneTechPack({
    ...techPack,
    spuName: options.spuName || techPack.spuName,
    skuCatalog: normalizedSeedSkuCatalog || techPack.skuCatalog || [],
  })

  state.currentSpuCode = options.currentSpuCode
  state.currentStyleId = options.styleId
  state.currentTechnicalVersionId = options.technicalVersionId
  state.currentTechnicalVersionCode = options.technicalVersionCode
  state.techPack = nextTechPack
  state.activeTab = options.activeTab ?? state.activeTab
  state.compatibilityMode = false
  state.compatibilityMessage = ''
  state.compatibilitySourceKind = null
  state.compatibilityMaintenancePath = ''
  state.compatibilityMaintenanceTitle = ''
  state.compatibilitySourceNote = ''
  state.compatibilitySourceNoteOpen = false

  state.patternItems = buildPatternItemsFromTechPack(nextTechPack)
  state.bomItems = buildBomItemsFromTechPack(nextTechPack)
  state.techniques = buildTechniquesFromTechPack(nextTechPack, state.bomItems)
  state.qualityRules = cloneQualityRules(options.qualityRules)
  state.materialCostRows = buildMaterialCostRows(state.bomItems, nextTechPack)
  state.processCostRows = buildProcessCostRows(state.techniques, nextTechPack)
  state.customCostRows = buildCustomCostRows(nextTechPack)
  const loadedMappings = buildColorMaterialMappings(nextTechPack)
  state.colorMaterialMappings =
    loadedMappings.length > 0 ? loadedMappings : buildSystemSuggestedColorMappings()
}

function clearTechPackState(spuCode: string, compatibilityMode = false): void {
  state.currentSpuCode = spuCode
  state.currentStyleId = null
  state.currentTechnicalVersionId = null
  state.currentTechnicalVersionCode = null
  state.techPack = null
  state.patternItems = []
  state.bomItems = []
  state.techniques = []
  state.qualityRules = []
  state.materialCostRows = []
  state.processCostRows = []
  state.customCostRows = []
  state.colorMaterialMappings = []
  state.compatibilityMode = false
  state.compatibilityMessage = ''
  state.compatibilitySourceKind = null
  state.compatibilityMaintenancePath = ''
  state.compatibilityMaintenanceTitle = ''
  state.compatibilitySourceNote = ''
  state.compatibilitySourceNoteOpen = false
}

function normalizeSeedSkuCatalog(skuCatalog: readonly TechPackSkuLine[]): TechPackSkuLine[] {
  const deduped = new Map<string, TechPackSkuLine>()
  for (const item of skuCatalog) {
    const skuCode = item.skuCode?.trim()
    if (!skuCode) continue
    deduped.set(skuCode, {
      skuCode,
      color: item.color?.trim() || '未识别颜色',
      size: item.size?.trim() || '-',
    })
  }
  return Array.from(deduped.values())
}

function shouldReplaceSkuCatalog(
  current: TechPackSkuLine[] | undefined,
  next: TechPackSkuLine[],
): boolean {
  if ((current?.length ?? 0) !== next.length) return true
  if (!current) return true
  const currentMap = new Map(current.map((item) => [item.skuCode, `${item.color || ''}|${item.size || ''}`]))
  if (currentMap.size !== next.length) return true

  return next.some((item) => currentMap.get(item.skuCode) !== `${item.color || ''}|${item.size || ''}`)
}

function mapDifficultyToZh(value: DifficultyLevel): TechniqueItem['difficulty'] {
  if (value === 'LOW') return '简单'
  if (value === 'HIGH') return '困难'
  return '中等'
}

function mapDifficultyToEnum(value: TechniqueItem['difficulty']): DifficultyLevel {
  if (value === '简单') return 'LOW'
  if (value === '困难') return 'HIGH'
  return 'MEDIUM'
}

function getStageName(stageCode: 'PREP' | 'PROD' | 'POST'): string {
  return stageCodeToName.get(stageCode) || stageCode
}

function getBaselineProcessByCode(code: string): BaselineProcessOption | null {
  return baselineProcessOptions.find((item) => item.processCode === code) ?? null
}

function getTechniqueProcessOptions(stageCode: '' | 'PREP' | 'PROD' | 'POST') {
  if (!stageCode) return []
  return listProcessesByStageCode(stageCode).map((item) => ({
    processCode: item.processCode,
    processName: item.processName,
    stageCode: item.stageCode,
    stageName: getStageName(item.stageCode),
  }))
}

function getTechniqueCraftOptions(
  stageCode: '' | 'PREP' | 'PROD' | 'POST',
  processCode: string,
): CraftOption[] {
  if (!stageCode || !processCode) return []
  return craftOptions.filter(
    (item) => item.stageCode === stageCode && item.processCode === processCode,
  )
}

function isPrepStage(stage: string): boolean {
  return stageNameToCode.get(stage) === 'PREP'
}

function isPrepDemandProcessCode(processCode: string): processCode is PrepDemandProcessCode {
  return prepDemandProcessCodes.includes(processCode as PrepDemandProcessCode)
}

function isBomDrivenPrepTechnique(
  item: Pick<TechniqueItem, 'stageCode' | 'processCode'>,
): item is Pick<TechniqueItem, 'stageCode' | 'processCode'> & { processCode: PrepDemandProcessCode } {
  return item.stageCode === 'PREP' && isPrepDemandProcessCode(item.processCode)
}

function hasPrintDemand(bomItems: BomItemRow[]): boolean {
  return bomItems.some((item) => (item.printRequirement || '无') !== '无')
}

function hasDyeDemand(bomItems: BomItemRow[]): boolean {
  return bomItems.some((item) => (item.dyeRequirement || '无') !== '无')
}

function getRequiredPrepProcessCodes(bomItems: BomItemRow[]): PrepDemandProcessCode[] {
  const codes: PrepDemandProcessCode[] = []
  if (hasPrintDemand(bomItems)) codes.push('PRINT')
  if (hasDyeDemand(bomItems)) codes.push('DYE')
  return codes
}

function createBomDrivenPrepTechnique(
  processCode: PrepDemandProcessCode,
  existing?: TechniqueItem,
): TechniqueItem {
  const baseline = getBaselineProcessByCode(processCode)

  return {
    id: existing?.id || `tech-prep-${processCode.toLowerCase()}`,
    entryType: 'PROCESS_BASELINE',
    stageCode: 'PREP',
    stage: baseline?.stageName || '准备阶段',
    processCode,
    process: baseline?.processName || (processCode === 'PRINT' ? '印花' : '染色'),
    craftCode: '',
    technique: baseline?.processName || (processCode === 'PRINT' ? '印花' : '染色'),
    assignmentGranularity: baseline?.assignmentGranularity || 'COLOR',
    ruleSource: 'INHERIT_PROCESS',
    detailSplitMode: baseline?.detailSplitMode || 'COMPOSITE',
    detailSplitDimensions: [...(baseline?.detailSplitDimensions || ['PATTERN', 'MATERIAL_SKU'])],
    defaultDocType: baseline?.defaultDocType || 'DEMAND',
    taskTypeMode: baseline?.taskTypeMode || 'PROCESS',
    isSpecialCraft: false,
    triggerSource: baseline?.triggerSource || '',
    standardTime: existing?.standardTime ?? (processCode === 'DYE' ? 10 : 12),
    timeUnit: existing?.timeUnit || '分钟/件',
    referencePublishedSamValue: existing?.referencePublishedSamValue ?? null,
    referencePublishedSamUnit: existing?.referencePublishedSamUnit || '',
    referencePublishedSamUnitLabel: existing?.referencePublishedSamUnitLabel || '',
    referencePublishedSamNote:
      existing?.referencePublishedSamNote ||
      '当前为工序级准备项，如需锁定具体参考值与推荐单位，请在当前款下选择具体工艺。',
    difficulty: existing?.difficulty || '中等',
    remark: existing?.remark || '',
    source: '字典引用',
  }
}

function syncBomDrivenPrepTechniques(
  techniques: TechniqueItem[],
  bomItems: BomItemRow[],
): TechniqueItem[] {
  const requiredCodes = getRequiredPrepProcessCodes(bomItems)
  const existingByCode = new Map<PrepDemandProcessCode, TechniqueItem>()
  const prepManualItems: TechniqueItem[] = []
  const nonPrepItems: TechniqueItem[] = []
  const manualPrepProcessCodes = new Set<PrepDemandProcessCode>()

  techniques.forEach((item) => {
    const normalizedItem = {
      ...item,
      detailSplitDimensions: [...item.detailSplitDimensions],
    }

    if (isBomDrivenPrepTechnique(normalizedItem) && normalizedItem.entryType === 'PROCESS_BASELINE') {
      if (!existingByCode.has(normalizedItem.processCode)) {
        existingByCode.set(normalizedItem.processCode, normalizedItem)
      }
      return
    }

    if (normalizedItem.stageCode === 'PREP') {
      prepManualItems.push(normalizedItem)
      if (isPrepDemandProcessCode(normalizedItem.processCode)) {
        manualPrepProcessCodes.add(normalizedItem.processCode)
      }
      return
    }

    nonPrepItems.push(normalizedItem)
  })

  const prepDemandItems = requiredCodes
    .filter((code) => !manualPrepProcessCodes.has(code))
    .map((code) => createBomDrivenPrepTechnique(code, existingByCode.get(code)))

  return [...prepManualItems, ...prepDemandItems, ...nonPrepItems]
}

function getCraftOptionByCode(code: string): CraftOption | null {
  return craftOptions.find((item) => item.craftCode === code) ?? null
}

function getTechniqueReferenceMetaByCraftCode(craftCode: string): Pick<
  TechniqueItem,
  | 'referencePublishedSamValue'
  | 'referencePublishedSamUnit'
  | 'referencePublishedSamUnitLabel'
  | 'referencePublishedSamNote'
> {
  const craft = craftCode ? getProcessCraftByCode(craftCode) : undefined
  if (!craft) {
    return {
      referencePublishedSamValue: null,
      referencePublishedSamUnit: '',
      referencePublishedSamUnitLabel: '',
      referencePublishedSamNote: '当前为工序级准备项，如需锁定具体参考值与推荐单位，请在当前款下选择具体工艺。',
    }
  }

  return {
    referencePublishedSamValue: craft.referencePublishedSamValue,
    referencePublishedSamUnit: craft.referencePublishedSamUnit,
    referencePublishedSamUnitLabel: PUBLISHED_SAM_UNIT_LABEL[craft.referencePublishedSamUnit],
    referencePublishedSamNote: craft.referencePublishedSamNote,
  }
}

function getSelectedDraftMeta():
  | {
      entryType: TechPackProcessEntryType
      stageCode: 'PREP' | 'PROD' | 'POST'
      stageName: string
      processCode: string
      processName: string
      craftCode: string
      craftName: string
      ruleSource: TechPackRuleSource
      assignmentGranularity: TechPackAssignmentGranularity
      detailSplitMode: TechPackDetailSplitMode
      detailSplitDimensions: TechPackDetailSplitDimension[]
      defaultDocType: 'DEMAND' | 'TASK'
      taskTypeMode: 'PROCESS' | 'CRAFT'
      isSpecialCraft: boolean
      triggerSource: string
    }
  | null {
  if (state.newTechnique.stageCode && state.newTechnique.processCode && state.newTechnique.craftCode) {
    const craft = getTechniqueCraftOptions(
      state.newTechnique.stageCode,
      state.newTechnique.processCode,
    ).find((item) => item.craftCode === state.newTechnique.craftCode)
    if (!craft) return null
    return {
      entryType: 'CRAFT',
      stageCode: craft.stageCode,
      stageName: craft.stageName,
      processCode: craft.processCode,
      processName: craft.processName,
      craftCode: craft.craftCode,
      craftName: craft.craftName,
      ruleSource: craft.ruleSource,
      assignmentGranularity: craft.assignmentGranularity,
      detailSplitMode: craft.detailSplitMode,
      detailSplitDimensions: [...craft.detailSplitDimensions],
      defaultDocType: craft.defaultDocType,
      taskTypeMode: craft.taskTypeMode,
      isSpecialCraft: craft.isSpecialCraft,
      triggerSource: '',
    }
  }

  if (state.newTechnique.entryType === 'PROCESS_BASELINE') {
    const baseline = getBaselineProcessByCode(state.newTechnique.baselineProcessCode)
    if (!baseline) return null
    return {
      entryType: 'PROCESS_BASELINE',
      stageCode: baseline.stageCode,
      stageName: baseline.stageName,
      processCode: baseline.processCode,
      processName: baseline.processName,
      craftCode: '',
      craftName: baseline.processName,
      assignmentGranularity: baseline.assignmentGranularity,
      ruleSource: 'INHERIT_PROCESS',
      detailSplitMode: baseline.detailSplitMode,
      detailSplitDimensions: [...baseline.detailSplitDimensions],
      defaultDocType: baseline.defaultDocType,
      taskTypeMode: baseline.taskTypeMode,
      isSpecialCraft: false,
      triggerSource: baseline.triggerSource,
    }
  }

  const craft = getCraftOptionByCode(state.newTechnique.craftCode)
  if (!craft) return null
  const forceOverride = craft.isSpecialCraft
  const ruleSource = forceOverride ? 'OVERRIDE_CRAFT' : state.newTechnique.ruleSource
  const effectiveRuleSource: TechPackRuleSource = ruleSource === 'OVERRIDE_CRAFT' ? 'OVERRIDE_CRAFT' : 'INHERIT_PROCESS'
  const assignmentGranularity =
    effectiveRuleSource === 'OVERRIDE_CRAFT'
      ? state.newTechnique.assignmentGranularity
      : craft.assignmentGranularity
  const detailSplitMode =
    effectiveRuleSource === 'OVERRIDE_CRAFT'
      ? state.newTechnique.detailSplitMode
      : craft.detailSplitMode
  const detailSplitDimensions =
    effectiveRuleSource === 'OVERRIDE_CRAFT'
      ? state.newTechnique.detailSplitDimensions.length > 0
        ? [...state.newTechnique.detailSplitDimensions]
        : [...craft.detailSplitDimensions]
      : [...craft.detailSplitDimensions]
  return {
    entryType: 'CRAFT',
    stageCode: craft.stageCode,
    stageName: craft.stageName,
    processCode: craft.processCode,
    processName: craft.processName,
    craftCode: craft.craftCode,
    craftName: craft.craftName,
    ruleSource: effectiveRuleSource,
    assignmentGranularity,
    detailSplitMode,
    detailSplitDimensions,
    defaultDocType: craft.defaultDocType,
    taskTypeMode: craft.taskTypeMode,
    isSpecialCraft: craft.isSpecialCraft,
    triggerSource: '',
  }
}

function canEditTechnique(item: TechniqueItem): boolean {
  if (isBomDrivenPrepTechnique(item)) return false
  return item.stageCode !== 'PROD' && item.stageCode !== 'POST'
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((item) => item.trim().length > 0)))
}

function formatDetailSplitDimensionsText(dimensions: TechPackDetailSplitDimension[]): string {
  if (dimensions.length === 0) return '-'
  return dimensions.map((item) => DETAIL_SPLIT_DIMENSION_LABEL[item]).join(' + ')
}

function formatPatternSpec(widthCm: number, markerLengthM: number): string {
  const width = Number.isFinite(widthCm) && widthCm > 0 ? `${widthCm}cm` : '-'
  const markerLength = Number.isFinite(markerLengthM) && markerLengthM > 0 ? `${markerLengthM}m` : '-'
  if (width === '-' && markerLength === '-') return '-'
  if (width === '-') return markerLength
  if (markerLength === '-') return width
  return `${width} × ${markerLength}`
}

const colorMappingStatusLabel: Record<TechPackColorMappingStatus, string> = {
  AUTO_CONFIRMED: '系统自动确认',
  AUTO_DRAFT: '系统草稿待确认',
  CONFIRMED: '已确认',
  MANUAL_ADJUSTED: '人工调整',
}

const colorMappingStatusClass: Record<TechPackColorMappingStatus, string> = {
  AUTO_CONFIRMED: 'border-blue-200 bg-blue-50 text-blue-700',
  AUTO_DRAFT: 'border-amber-200 bg-amber-50 text-amber-700',
  CONFIRMED: 'border-green-200 bg-green-50 text-green-700',
  MANUAL_ADJUSTED: 'border-purple-200 bg-purple-50 text-purple-700',
}

const generatedModeLabel: Record<TechPackColorMappingGeneratedMode, string> = {
  AUTO: '系统生成',
  MANUAL: '人工维护',
}

function normalizeColorMappingLineRows(
  lines: Array<Partial<ColorMaterialMappingLineRow>>,
  mappingId: string,
): ColorMaterialMappingLineRow[] {
  return lines.map((line, index) => ({
    id: line.id || `${mappingId}-L${index + 1}`,
    bomItemId: line.bomItemId?.trim() || '',
    materialCode: line.materialCode?.trim() || '',
    materialName: line.materialName?.trim() || '-',
    materialType: line.materialType?.trim() || '其他',
    patternId: line.patternId?.trim() || '',
    patternName: line.patternName?.trim() || '',
    pieceId: line.pieceId?.trim() || '',
    pieceName: line.pieceName?.trim() || '',
    pieceCountPerUnit: Number.isFinite(Number(line.pieceCountPerUnit))
      ? Number(line.pieceCountPerUnit)
      : 0,
    unit: line.unit?.trim() || '件',
    applicableSkuCodes: dedupeStrings([...(line.applicableSkuCodes ?? [])]),
    sourceMode: line.sourceMode === 'MANUAL' ? 'MANUAL' : 'AUTO',
    note: line.note?.trim() || '',
  }))
}

function buildColorMaterialMappings(techPack: TechPack): ColorMaterialMappingRow[] {
  return (techPack.colorMaterialMappings ?? []).map((item) => ({
    id: item.id,
    spuCode: item.spuCode,
    colorCode: item.colorCode,
    colorName: item.colorName,
    status: item.status,
    generatedMode: item.generatedMode,
    confirmedBy: item.confirmedBy || '',
    confirmedAt: item.confirmedAt || '',
    remark: item.remark || '',
    lines: normalizeColorMappingLineRows(item.lines, item.id),
  }))
}

function getSkuOptionsForCurrentSpu(): SkuOption[] {
  if (!state.techPack) return []
  const byCode = new Map<string, SkuOption>()

  for (const line of state.techPack.skuCatalog ?? []) {
    if (!byCode.has(line.skuCode)) {
      byCode.set(line.skuCode, {
        skuCode: line.skuCode,
        color: line.color || '未识别颜色',
        size: line.size || '-',
      })
    }
  }

  for (const order of productionOrders) {
    if (order.demandSnapshot.spuCode !== state.techPack.spuCode) continue
    for (const line of order.demandSnapshot.skuLines) {
      if (!byCode.has(line.skuCode)) {
        byCode.set(line.skuCode, {
          skuCode: line.skuCode,
          color: line.color || '未识别颜色',
          size: line.size || '-',
        })
      }
    }
  }

  for (const item of state.bomItems) {
    for (const skuCode of item.applicableSkuCodes) {
      if (!byCode.has(skuCode)) {
        byCode.set(skuCode, { skuCode, color: '未识别颜色', size: '-' })
      }
    }
  }

  return Array.from(byCode.values())
}

function getSkuCodesByColor(colorCodeOrName: string): string[] {
  const token = colorCodeOrName.trim().toLowerCase()
  if (!token) return []
  return getSkuOptionsForCurrentSpu()
    .filter((item) => item.color.trim().toLowerCase() === token || item.skuCode.toLowerCase().includes(token))
    .map((item) => item.skuCode)
}

function getPatternById(patternId: string): PatternItem | null {
  return state.patternItems.find((item) => item.id === patternId) ?? null
}

function getPatternPieceById(patternId: string, pieceId: string): PatternPieceRow | null {
  const pattern = getPatternById(patternId)
  if (!pattern) return null
  return pattern.pieceRows.find((row) => row.id === pieceId) ?? null
}

function createEmptyMappingLine(mappingId: string): ColorMaterialMappingLineRow {
  return {
    id: `${mappingId}-L${Date.now()}`,
    bomItemId: '',
    materialCode: '',
    materialName: '',
    materialType: '其他',
    patternId: '',
    patternName: '',
    pieceId: '',
    pieceName: '',
    pieceCountPerUnit: 0,
    unit: '片',
    applicableSkuCodes: [],
    sourceMode: 'MANUAL',
    note: '',
  }
}

function isComplexColorMappingScenario(colorCount: number): boolean {
  if (colorCount > 1) return true
  const hasPieceSkuRestriction = state.patternItems.some((pattern) =>
    pattern.pieceRows.some((piece) => piece.applicableSkuCodes.length > 0),
  )
  const hasBomSkuRestriction = state.bomItems.some((item) => item.applicableSkuCodes.length > 0)
  return hasPieceSkuRestriction || hasBomSkuRestriction
}

function buildAutoMappingLinesForColor(
  colorName: string,
  mappingId: string,
): ColorMaterialMappingLineRow[] {
  const skuCodesOfColor = getSkuCodesByColor(colorName)
  const skuCodeSet = new Set(skuCodesOfColor)

  return state.bomItems.flatMap((bomItem) => {
    const matchedSkuCodes =
      bomItem.applicableSkuCodes.length === 0
        ? skuCodesOfColor
        : skuCodesOfColor.filter((skuCode) => bomItem.applicableSkuCodes.includes(skuCode))

    if (matchedSkuCodes.length === 0) return []

    const linkedPatterns = state.patternItems.filter(
      (pattern) =>
        pattern.linkedBomItemId === bomItem.id || bomItem.linkedPatternIds.includes(pattern.id),
    )

    if (linkedPatterns.length === 0) {
      return [
        normalizeColorMappingLineRows(
          [
            {
              id: `${mappingId}-${bomItem.id}-M`,
              bomItemId: bomItem.id,
              materialCode: bomItem.materialCode,
              materialName: bomItem.materialName,
              materialType:
                bomItem.type === '面料' || bomItem.type === '辅料' ? bomItem.type : '其他',
              unit: bomItem.type === '辅料' ? '个' : '米',
              applicableSkuCodes: matchedSkuCodes,
              sourceMode: 'AUTO',
              note: `系统按 ${colorName} 自动匹配（未关联纸样）`,
            },
          ],
          mappingId,
        )[0],
      ]
    }

    return linkedPatterns.flatMap((pattern) => {
      const matchedPieces = pattern.pieceRows.filter((piece) => {
        if (piece.applicableSkuCodes.length === 0) return true
        return piece.applicableSkuCodes.some((skuCode) => skuCodeSet.has(skuCode))
      })

      if (matchedPieces.length === 0) {
        return [
          normalizeColorMappingLineRows(
            [
              {
                id: `${mappingId}-${bomItem.id}-${pattern.id}-M`,
                bomItemId: bomItem.id,
                materialCode: bomItem.materialCode,
                materialName: bomItem.materialName,
                materialType:
                  bomItem.type === '面料' || bomItem.type === '辅料' ? bomItem.type : '其他',
                patternId: pattern.id,
                patternName: pattern.name,
                unit: '片',
                applicableSkuCodes: matchedSkuCodes,
                sourceMode: 'AUTO',
                note: `系统按 ${colorName} 自动匹配（纸样无裁片明细）`,
              },
            ],
            mappingId,
          )[0],
        ]
      }

      return matchedPieces.map((piece) =>
        normalizeColorMappingLineRows(
          [
            {
              id: `${mappingId}-${bomItem.id}-${pattern.id}-${piece.id}`,
              bomItemId: bomItem.id,
              materialCode: bomItem.materialCode,
              materialName: bomItem.materialName,
              materialType:
                bomItem.type === '面料' || bomItem.type === '辅料' ? bomItem.type : '其他',
              patternId: pattern.id,
              patternName: pattern.name,
              pieceId: piece.id,
              pieceName: piece.name,
              pieceCountPerUnit: piece.count,
              unit: '片',
              applicableSkuCodes:
                piece.applicableSkuCodes.length > 0
                  ? matchedSkuCodes.filter((skuCode) => piece.applicableSkuCodes.includes(skuCode))
                  : matchedSkuCodes,
              sourceMode: 'AUTO',
              note: `系统按 ${colorName} 自动生成`,
            },
          ],
          mappingId,
        )[0],
      )
    })
  })
}

function buildSystemSuggestedColorMappings(): ColorMaterialMappingRow[] {
  if (!state.techPack) return []

  const skuOptions = getSkuOptionsForCurrentSpu()
  const colorMap = new Map<string, { colorCode: string; colorName: string }>()
  skuOptions.forEach((sku) => {
    const colorName = sku.color || '未识别颜色'
    const colorCode = colorName.toUpperCase().replace(/\s+/g, '_')
    colorMap.set(colorCode, { colorCode, colorName })
  })
  if (colorMap.size === 0) {
    colorMap.set('ALL', { colorCode: 'ALL', colorName: '全部颜色' })
  }

  const complex = isComplexColorMappingScenario(colorMap.size)
  const defaultStatus: TechPackColorMappingStatus =
    complex ? 'AUTO_DRAFT' : 'AUTO_CONFIRMED'

  return Array.from(colorMap.values()).map((color) => {
    const mappingId = `MAP-${state.techPack?.spuCode || 'SPU'}-${color.colorCode}`
    return {
      id: mappingId,
      spuCode: state.techPack?.spuCode || '',
      colorCode: color.colorCode,
      colorName: color.colorName,
      status: defaultStatus,
      generatedMode: 'AUTO',
      confirmedBy: defaultStatus === 'AUTO_CONFIRMED' ? '系统' : '',
      confirmedAt: defaultStatus === 'AUTO_CONFIRMED' ? toTimestamp() : '',
      remark:
        defaultStatus === 'AUTO_CONFIRMED'
          ? '单色或简单款，系统自动生成并直接确认。'
          : '多色或复杂款，系统生成草稿，待人工确认。',
      lines: buildAutoMappingLinesForColor(color.colorName, mappingId),
    }
  })
}

function touchMappingAsManual(mapping: ColorMaterialMappingRow): ColorMaterialMappingRow {
  return {
    ...mapping,
    status: 'MANUAL_ADJUSTED',
    generatedMode: 'MANUAL',
    confirmedBy: '',
    confirmedAt: '',
    remark: mapping.remark || '人工修订后待确认',
    lines: mapping.lines.map((line) => ({ ...line, sourceMode: 'MANUAL' })),
  }
}

function updateColorMapping(
  mappingId: string,
  updater: (mapping: ColorMaterialMappingRow) => ColorMaterialMappingRow,
): void {
  state.colorMaterialMappings = state.colorMaterialMappings.map((mapping) =>
    mapping.id === mappingId ? updater(mapping) : mapping,
  )
}

function updateColorMappingLine(
  mappingId: string,
  lineId: string,
  updater: (line: ColorMaterialMappingLineRow) => ColorMaterialMappingLineRow,
): void {
  updateColorMapping(mappingId, (mapping) =>
    touchMappingAsManual({
      ...mapping,
      lines: mapping.lines.map((line) => (line.id === lineId ? updater(line) : line)),
    }),
  )
}

function copySystemDraftToManual(mappingId: string): void {
  updateColorMapping(mappingId, (mapping) => ({
    ...touchMappingAsManual(mapping),
    remark: mapping.remark || '系统草稿已复制为人工版本，可继续修订并确认',
    lines: mapping.lines.map((line) => ({ ...line, sourceMode: 'MANUAL' })),
  }))
}

function resetColorMappingToSystemSuggestion(mappingId: string): void {
  const suggestions = buildSystemSuggestedColorMappings()
  const suggested = suggestions.find((item) => item.id === mappingId)
  if (!suggested) return

  updateColorMapping(mappingId, () => suggested)
}

function getPatternBySelectionKey(selectionKey: string): PatternItem | null {
  return (
    state.patternItems.find((item) => item.id === selectionKey) ??
    state.patternItems.find((item) => item.name === selectionKey) ??
    null
  )
}

function normalizePatternPieceRows(rows: PatternPieceRow[], patternId: string): PatternPieceRow[] {
  return rows.map((row, index) => ({
    id: row.id || `${patternId}-piece-${index + 1}`,
    name: String(row.name || '').trim(),
    count: Number.isFinite(row.count) ? Number(row.count) : Number.parseInt(String(row.count || ''), 10) || 0,
    note: String(row.note || '').trim(),
    applicableSkuCodes: dedupeStrings([...(row.applicableSkuCodes ?? [])]),
    sourceType: row.sourceType === 'PARSED_PATTERN' ? 'PARSED_PATTERN' : 'MANUAL',
    sourcePartName: row.sourcePartName?.trim() || undefined,
    systemPieceName: row.systemPieceName?.trim() || undefined,
    candidatePartNames: dedupeStrings([...(row.candidatePartNames ?? [])]),
    sizeCode: row.sizeCode?.trim() || undefined,
    quantityText: row.quantityText?.trim() || undefined,
    annotation: row.annotation?.trim() || undefined,
    category: row.category?.trim() || undefined,
    width: Number.isFinite(row.width) ? Number(row.width) : undefined,
    height: Number.isFinite(row.height) ? Number(row.height) : undefined,
    area: Number.isFinite(row.area) ? Number(row.area) : undefined,
    perimeter: Number.isFinite(row.perimeter) ? Number(row.perimeter) : undefined,
    geometryHash: row.geometryHash?.trim() || undefined,
    previewSvg: row.previewSvg?.trim() || undefined,
    parserStatus: row.parserStatus || undefined,
    machineReadyStatus: row.machineReadyStatus || undefined,
    rawTextLabels: dedupeStrings([...(row.rawTextLabels ?? [])]),
    missingName: Boolean(row.missingName),
    missingCount: Boolean(row.missingCount),
  }))
}

function buildPatternDisplayFile(input: {
  patternFileMode: TechPackPatternFileMode
  dxfFileName?: string
  rulFileName?: string
  singlePatternFileName?: string
  fileName?: string
}): string {
  if (input.patternFileMode === 'PAIRED_DXF_RUL') {
    const dxf = String(input.dxfFileName || '').trim()
    const rul = String(input.rulFileName || '').trim()
    if (dxf && rul) return `${dxf} / ${rul}`
    return dxf || rul || String(input.fileName || '').trim()
  }
  return String(input.singlePatternFileName || input.fileName || '').trim()
}

function buildPatternName(input: {
  patternName?: string
  fileName?: string
  singlePatternFileName?: string
  dxfFileName?: string
}, fallbackIndex: number): string {
  const explicitName = String(input.patternName || '').trim()
  if (explicitName) return explicitName
  const fallbackFileName = String(input.singlePatternFileName || input.dxfFileName || input.fileName || '').trim()
  if (fallbackFileName) return fallbackFileName.replace(/\.[^/.]+$/, '')
  return `纸样${fallbackIndex + 1}`
}

function buildPatternItemsFromTechPack(techPack: TechPack): PatternItem[] {
  if (techPack.patternFiles.length === 0) {
    return DEFAULT_PATTERN_ITEMS.map((item) => ({
      ...item,
      pieceRows: item.pieceRows.map((row) => ({ ...row })),
    }))
  }

  return techPack.patternFiles.map((item, index) => {
    const patternId = item.id || `PAT-${index + 1}`
    const linkedBom = techPack.bomItems.find((bom) => bom.id === item.linkedBomItemId) || null
    const normalizedRows = normalizePatternPieceRows(
      (item.pieceRows ?? []).map((row) => ({
        id: row.id || '',
        name: row.name,
        count: Number(row.count),
        note: row.note || '',
        applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
        sourceType: row.sourceType === 'PARSED_PATTERN' ? 'PARSED_PATTERN' : 'MANUAL',
        sourcePartName: row.sourcePartName,
        systemPieceName: row.systemPieceName,
        candidatePartNames: [...(row.candidatePartNames ?? [])],
        sizeCode: row.sizeCode,
        quantityText: row.quantityText,
        annotation: row.annotation,
        category: row.category,
        width: row.width,
        height: row.height,
        area: row.area,
        perimeter: row.perimeter,
        geometryHash: row.geometryHash,
        previewSvg: row.previewSvg,
        parserStatus: row.parserStatus,
        machineReadyStatus: row.machineReadyStatus,
        rawTextLabels: [...(row.rawTextLabels ?? [])],
        missingName: (row as PatternPieceRow).missingName,
        missingCount: (row as PatternPieceRow).missingCount,
      })),
      patternId,
    )
    const inferredPieceCount = normalizedRows.reduce((sum, row) => sum + row.count, 0)
    const patternMaterialType =
      normalizePatternMaterialType(item.patternMaterialType)
      || inferPatternMaterialTypeFromPatternFile({
        fileName: item.fileName,
        singlePatternFileName: item.singlePatternFileName,
        dxfFileName: item.dxfFileName,
        linkedBomItemId: item.linkedBomItemId,
        linkedBomName: linkedBom?.name,
        linkedBomSpec: linkedBom?.spec,
        linkedBomType: linkedBom?.type,
      })
    const normalizedMaterialType =
      patternMaterialType === 'UNKNOWN'
        ? inferPatternMaterialTypeFromPatternFile({
            fileName: item.fileName,
            singlePatternFileName: item.singlePatternFileName,
            dxfFileName: item.dxfFileName,
            linkedBomItemId: item.linkedBomItemId,
            linkedBomName: linkedBom?.name,
            linkedBomSpec: linkedBom?.spec,
            linkedBomType: linkedBom?.type,
          })
        : patternMaterialType
    const patternFileMode =
      item.patternFileMode === 'PAIRED_DXF_RUL' || item.patternFileMode === 'SINGLE_FILE'
        ? item.patternFileMode
        : inferPatternFileMode(normalizedMaterialType)
    const parseStatus = normalizePatternParseStatus(item.parseStatus)
    const patternName = buildPatternName(item, index)

    return {
      id: patternId,
      name: patternName,
      type: (item.patternCategory as TechPackPatternCategory) || '主体片',
      image: item.imageUrl || '',
      file: buildPatternDisplayFile({
        patternFileMode,
        dxfFileName: item.dxfFileName,
        rulFileName: item.rulFileName,
        singlePatternFileName: item.singlePatternFileName,
        fileName: item.fileName,
      }),
      remark: item.remark || '',
      linkedBomItemId: item.linkedBomItemId ?? '',
      // 门幅单位固定 cm
      widthCm: Number.isFinite(item.widthCm) ? Number(item.widthCm) : 0,
      // 排料长度单位固定 m
      markerLengthM: Number.isFinite(item.markerLengthM) ? Number(item.markerLengthM) : 0,
      // totalPieceCount 固定语义：裁片总片数
      totalPieceCount:
        Number.isFinite(item.totalPieceCount) && Number(item.totalPieceCount) > 0
          ? Number(item.totalPieceCount)
          : inferredPieceCount,
      patternMaterialType: normalizedMaterialType,
      patternMaterialTypeLabel:
        String(item.patternMaterialTypeLabel || '').trim() || getPatternMaterialTypeLabel(normalizedMaterialType),
      patternFileMode,
      parseStatus,
      parseStatusLabel:
        String(item.parseStatusLabel || '').trim() || getPatternParseStatusLabel(parseStatus),
      parseError: item.parseError || '',
      parsedAt: item.parsedAt || '',
      dxfFileName: item.dxfFileName || '',
      dxfFileSize: Number.isFinite(item.dxfFileSize) ? Number(item.dxfFileSize) : 0,
      dxfLastModified: item.dxfLastModified || '',
      rulFileName: item.rulFileName || '',
      rulFileSize: Number.isFinite(item.rulFileSize) ? Number(item.rulFileSize) : 0,
      rulLastModified: item.rulLastModified || '',
      singlePatternFileName: item.singlePatternFileName || '',
      singlePatternFileSize:
        Number.isFinite(item.singlePatternFileSize) ? Number(item.singlePatternFileSize) : 0,
      singlePatternFileLastModified: item.singlePatternFileLastModified || '',
      dxfEncoding: item.dxfEncoding || '',
      rulEncoding: item.rulEncoding || '',
      rulSizeList: [...(item.rulSizeList ?? [])],
      rulSampleSize: item.rulSampleSize || '',
      patternSoftwareName: item.patternSoftwareName || '',
      sizeRange: item.sizeRange || '',
      pieceRows: normalizedRows,
    }
  })
}

function buildBomItemsFromTechPack(techPack: TechPack): BomItemRow[] {
  if (techPack.bomItems.length === 0) {
    return DEFAULT_BOM_ITEMS.map((item) => ({
      ...item,
      patternPieces: [...item.patternPieces],
      linkedPatternIds: [...item.linkedPatternIds],
      applicableSkuCodes: [...item.applicableSkuCodes],
      usageProcessCodes: [...item.usageProcessCodes],
    }))
  }

  const patternNameById = new Map(
    techPack.patternFiles.map((item) => [item.id, item.fileName.replace(/\.[^/.]+$/, '')]),
  )
  const patternNamesByLinkedBom = new Map<string, string[]>()
  techPack.patternFiles.forEach((item) => {
    if (!item.linkedBomItemId) return
    const current = patternNamesByLinkedBom.get(item.linkedBomItemId) ?? []
    current.push(item.fileName.replace(/\.[^/.]+$/, ''))
    patternNamesByLinkedBom.set(item.linkedBomItemId, current)
  })

  return techPack.bomItems.map((item, index) => {
    const linkedPatternIds = dedupeStrings([...(item.linkedPatternIds ?? [])])
    const namesFromLinkedIds = linkedPatternIds
      .map((id) => patternNameById.get(id) || '')
      .filter((name) => name.trim().length > 0)
    const namesFromLinkedBom = patternNamesByLinkedBom.get(item.id) ?? []
    const patternPieces = dedupeStrings([...namesFromLinkedIds, ...namesFromLinkedBom])

    return {
      id: item.id || `bom-${index + 1}`,
      type: item.type,
      colorLabel: item.colorLabel || '',
      materialCode: item.id || `MAT-${index + 1}`,
      materialName: item.name,
      spec: item.spec,
      patternPieces,
      linkedPatternIds,
      applicableSkuCodes: [...(item.applicableSkuCodes ?? [])],
      usageProcessCodes: [...(item.usageProcessCodes ?? [])],
      usage: item.unitConsumption,
      lossRate: item.lossRate,
      printRequirement: item.printRequirement ?? '无',
      dyeRequirement: item.dyeRequirement ?? '无',
    }
  })
}

function toTechniqueItemFromEntry(entry: TechPackProcessEntry, fallbackIndex: number): TechniqueItem {
  const normalizedEntry = resolveTechPackProcessEntryRule(entry)
  const referenceMeta = normalizedEntry.craftCode
    ? getTechniqueReferenceMetaByCraftCode(normalizedEntry.craftCode)
    : getTechniqueReferenceMetaByCraftCode('')
  return {
    id: normalizedEntry.id || `tech-${fallbackIndex + 1}`,
    entryType: normalizedEntry.entryType,
    stageCode: normalizedEntry.stageCode,
    stage: normalizedEntry.stageName,
    processCode: normalizedEntry.processCode,
    process: normalizedEntry.processName,
    craftCode: normalizedEntry.craftCode || '',
    technique: normalizedEntry.craftName || normalizedEntry.processName,
    assignmentGranularity: normalizedEntry.assignmentGranularity,
    ruleSource: normalizedEntry.ruleSource ?? 'INHERIT_PROCESS',
    detailSplitMode: normalizedEntry.detailSplitMode ?? 'COMPOSITE',
    detailSplitDimensions: [...(normalizedEntry.detailSplitDimensions ?? [])],
    defaultDocType: normalizedEntry.defaultDocType,
    taskTypeMode: normalizedEntry.taskTypeMode,
    isSpecialCraft: normalizedEntry.isSpecialCraft,
    triggerSource: normalizedEntry.triggerSource || '',
    standardTime: Number.isFinite(normalizedEntry.standardTimeMinutes)
      ? Number(normalizedEntry.standardTimeMinutes)
      : 0,
    timeUnit:
      normalizedEntry.referencePublishedSamUnitLabel ||
      normalizedEntry.timeUnit ||
      '分钟/件',
    referencePublishedSamValue:
      normalizedEntry.referencePublishedSamValue ?? referenceMeta.referencePublishedSamValue,
    referencePublishedSamUnit:
      normalizedEntry.referencePublishedSamUnit ?? referenceMeta.referencePublishedSamUnit,
    referencePublishedSamUnitLabel:
      normalizedEntry.referencePublishedSamUnitLabel ??
      referenceMeta.referencePublishedSamUnitLabel,
    referencePublishedSamNote:
      normalizedEntry.referencePublishedSamNote ?? referenceMeta.referencePublishedSamNote,
    difficulty: mapDifficultyToZh(normalizedEntry.difficulty || 'MEDIUM'),
    remark: normalizedEntry.remark || '',
    source: '字典引用',
  }
}

function buildTechniquesFromTechPack(
  techPack: TechPack,
  bomItems: BomItemRow[] = buildBomItemsFromTechPack(techPack),
): TechniqueItem[] {
  if ((techPack.processEntries ?? []).length > 0) {
    return syncBomDrivenPrepTechniques(
      (techPack.processEntries ?? []).map((entry, index) =>
        toTechniqueItemFromEntry(entry, index),
      ),
      bomItems,
    )
  }

  if (techPack.processes.length === 0) {
    return syncBomDrivenPrepTechniques(
      DEFAULT_TECHNIQUES.map((item) => ({
        ...item,
        detailSplitDimensions: [...item.detailSplitDimensions],
      })),
      bomItems,
    )
  }

  return syncBomDrivenPrepTechniques(
    techPack.processes.map((item, index) => {
      const craft = listProcessCraftDefinitions().find((craftItem) => craftItem.craftName === item.name)
      if (craft) {
        const processDef = getProcessDefinitionByCode(craft.processCode)
        const referenceMeta = getTechniqueReferenceMetaByCraftCode(craft.craftCode)
        return {
          id: item.id || `tech-${index + 1}`,
          entryType: 'CRAFT',
          stageCode: craft.stageCode,
          stage: getStageName(craft.stageCode),
          processCode: craft.processCode,
          process: processDef?.processName || craft.processCode,
          craftCode: craft.craftCode,
          technique: craft.craftName,
          assignmentGranularity: craft.assignmentGranularity,
          ruleSource: craft.ruleSource,
          detailSplitMode: craft.detailSplitMode,
          detailSplitDimensions: [...craft.detailSplitDimensions],
          defaultDocType: craft.defaultDocType,
          taskTypeMode: craft.taskTypeMode,
          isSpecialCraft: craft.isSpecialCraft,
          triggerSource: '',
          standardTime: item.timeMinutes,
          timeUnit: referenceMeta.referencePublishedSamUnitLabel || '分钟/件',
          referencePublishedSamValue: referenceMeta.referencePublishedSamValue,
          referencePublishedSamUnit: referenceMeta.referencePublishedSamUnit,
          referencePublishedSamUnitLabel: referenceMeta.referencePublishedSamUnitLabel,
          referencePublishedSamNote: referenceMeta.referencePublishedSamNote,
          difficulty: mapDifficultyToZh(item.difficulty),
          remark: '',
          source: '字典引用',
        }
      }

      const processDef = listProcessDefinitions().find(
        (processItem) => processItem.processName === item.name || processItem.systemProcessCode === item.name,
      )
      if (processDef) {
        return {
          id: item.id || `tech-${index + 1}`,
          entryType: 'PROCESS_BASELINE',
          stageCode: processDef.stageCode,
          stage: getStageName(processDef.stageCode),
          processCode: processDef.processCode,
          process: processDef.processName,
          craftCode: '',
          technique: processDef.processName,
          assignmentGranularity: processDef.assignmentGranularity,
          ruleSource: 'INHERIT_PROCESS',
          detailSplitMode: processDef.detailSplitMode,
          detailSplitDimensions: [...processDef.detailSplitDimensions],
          defaultDocType: processDef.defaultDocType,
          taskTypeMode: processDef.taskTypeMode,
          isSpecialCraft: false,
          triggerSource: processDef.triggerSource || '',
          standardTime: item.timeMinutes,
          timeUnit: '分钟/件',
          referencePublishedSamValue: null,
          referencePublishedSamUnit: '',
          referencePublishedSamUnitLabel: '',
          referencePublishedSamNote: '当前为工序级准备项，如需锁定具体参考值与推荐单位，请在当前款下选择具体工艺。',
          difficulty: mapDifficultyToZh(item.difficulty),
          remark: '',
          source: '字典引用',
        }
      }

      return {
        id: item.id || `tech-${index + 1}`,
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stage: getStageName('PROD'),
        processCode: 'SEW',
        process: '车缝',
        craftCode: '',
        technique: item.name,
        assignmentGranularity: 'SKU',
        ruleSource: 'INHERIT_PROCESS',
        detailSplitMode: 'COMPOSITE',
        detailSplitDimensions: ['GARMENT_SKU'],
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        triggerSource: '',
        standardTime: item.timeMinutes,
        timeUnit: '分钟/件',
        referencePublishedSamValue: null,
        referencePublishedSamUnit: '',
        referencePublishedSamUnitLabel: '',
        referencePublishedSamNote: '当前为工序级准备项，如需锁定具体参考值与推荐单位，请在当前款下选择具体工艺。',
        difficulty: mapDifficultyToZh(item.difficulty),
        remark: '',
        source: '字典引用',
      }
    }),
    bomItems,
  )
}

function buildMaterialCostRows(bomItems: BomItemRow[], techPack: TechPack): MaterialCostRow[] {
  const costByBomItemId = new Map((techPack.materialCostItems ?? []).map((item) => [item.bomItemId, item]))

  return bomItems.map((item) => ({
    id: item.id,
    materialName: item.materialName,
    spec: item.spec,
    usage: item.usage,
    price: String(costByBomItemId.get(item.id)?.price ?? ''),
    currency: costByBomItemId.get(item.id)?.currency || '人民币',
    unit: costByBomItemId.get(item.id)?.unit || '人民币/件',
  }))
}

function buildProcessCostRows(techniques: TechniqueItem[], techPack: TechPack): ProcessCostRow[] {
  const costByProcessId = new Map((techPack.processCostItems ?? []).map((item) => [item.processId, item]))

  return techniques.map((item) => ({
    id: item.id,
    stage: item.stage,
    process: item.process,
    technique: item.technique,
    price: String(costByProcessId.get(item.id)?.price ?? ''),
    currency: costByProcessId.get(item.id)?.currency || '人民币',
    unit: costByProcessId.get(item.id)?.unit || '人民币/件',
  }))
}

function buildCustomCostRows(techPack: TechPack): CustomCostRow[] {
  return (techPack.customCostItems ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    price: String(item.price ?? ''),
    currency: item.currency || '人民币',
    unit: item.unit || '人民币/项',
    remark: item.remark || '',
  }))
}

function syncMaterialCostRows(): void {
  const currentById = new Map(state.materialCostRows.map((row) => [row.id, row]))

  state.materialCostRows = state.bomItems.map((item) => {
    const current = currentById.get(item.id)
    if (!current) {
      return {
        id: item.id,
        materialName: item.materialName,
        spec: item.spec,
        usage: item.usage,
        price: '',
        currency: '人民币',
        unit: '人民币/件',
      }
    }

    return {
      ...current,
      materialName: item.materialName,
      spec: item.spec,
      usage: item.usage,
    }
  })
}

function syncProcessCostRows(): void {
  const currentById = new Map(state.processCostRows.map((row) => [row.id, row]))

  state.processCostRows = state.techniques.map((item) => {
    const current = currentById.get(item.id)
    if (!current) {
      return {
        id: item.id,
        stage: item.stage,
        process: item.process,
        technique: item.technique,
        price: '',
        currency: '人民币',
        unit: '人民币/件',
      }
    }

    return {
      ...current,
      stage: item.stage,
      process: item.process,
      technique: item.technique,
    }
  })
}

function getChecklist(): ChecklistItem[] {
  if (!state.techPack) return []

  const hasDesignRequirement = state.bomItems.some(
    (item) => item.printRequirement && item.printRequirement !== '无',
  )

  return [
    { key: 'bom', label: '物料清单', required: true, done: state.bomItems.length > 0 },
    { key: 'pattern', label: '纸样管理', required: true, done: state.patternItems.length > 0 },
    { key: 'process', label: '工序工艺', required: true, done: state.techniques.length > 0 },
    { key: 'size', label: '放码规则', required: true, done: state.techPack.sizeTable.length > 0 },
    { key: 'quality', label: '质检标准', required: true, done: state.qualityRules.length > 0 },
    {
      key: 'color-mapping',
      label: '款色用料对应',
      required: true,
      done: state.colorMaterialMappings.length > 0,
    },
    {
      key: 'design',
      label: '花型设计',
      required: hasDesignRequirement,
      done: state.techPack.patternDesigns.length > 0,
    },
  ]
}

function syncTechPackToStore(options: { touch: boolean; persist?: boolean } = { touch: true, persist: true }): void {
  if (!state.techPack) return

  state.techniques = syncBomDrivenPrepTechniques(state.techniques, state.bomItems)
  syncProcessCostRows()

  const checklist = getChecklist()
  const requiredItems = checklist.filter((item) => item.required)
  const doneCount = requiredItems.filter((item) => item.done).length
  const score = requiredItems.length === 0 ? 100 : Math.round((doneCount / requiredItems.length) * 100)
  const missing = requiredItems.filter((item) => !item.done).map((item) => item.label)
  const patternIdByName = new Map(state.patternItems.map((item) => [item.name, item.id]))

  const next: TechPack = {
    ...state.techPack,
    patternFiles: state.patternItems.map((item) => {
      const pieceRows = normalizePatternPieceRows(item.pieceRows, item.id)
      const inferredPieceCount = pieceRows.reduce((sum, row) => sum + row.count, 0)
      const legacyFileName = buildPatternDisplayFile({
        patternFileMode: item.patternFileMode,
        dxfFileName: item.dxfFileName,
        rulFileName: item.rulFileName,
        singlePatternFileName: item.singlePatternFileName,
        fileName: item.file,
      }) || `${item.name}.dxf`
      return {
        id: item.id,
        patternName: item.name,
        patternCategory: item.type,
        patternMaterialType: item.patternMaterialType,
        patternMaterialTypeLabel: item.patternMaterialTypeLabel,
        patternFileMode: item.patternFileMode,
        fileName: legacyFileName,
        fileUrl: '#',
        uploadedAt: state.techPack?.lastUpdatedAt || toTimestamp(),
        uploadedBy: currentUser.name,
        dxfFileName: item.dxfFileName || undefined,
        dxfFileSize: item.dxfFileSize > 0 ? item.dxfFileSize : undefined,
        dxfLastModified: item.dxfLastModified || undefined,
        rulFileName: item.rulFileName || undefined,
        rulFileSize: item.rulFileSize > 0 ? item.rulFileSize : undefined,
        rulLastModified: item.rulLastModified || undefined,
        singlePatternFileName: item.singlePatternFileName || undefined,
        singlePatternFileSize: item.singlePatternFileSize > 0 ? item.singlePatternFileSize : undefined,
        singlePatternFileLastModified: item.singlePatternFileLastModified || undefined,
        parseStatus: item.parseStatus,
        parseStatusLabel: item.parseStatusLabel,
        parseError: item.parseError || undefined,
        parsedAt: item.parsedAt || undefined,
        dxfEncoding: item.dxfEncoding || undefined,
        rulEncoding: item.rulEncoding || undefined,
        rulSizeList: item.rulSizeList.length > 0 ? [...item.rulSizeList] : undefined,
        rulSampleSize: item.rulSampleSize || undefined,
        patternSoftwareName: item.patternSoftwareName || undefined,
        sizeRange: item.sizeRange || undefined,
        imageUrl: item.image || undefined,
        remark: item.remark || undefined,
        linkedBomItemId: item.linkedBomItemId || undefined,
        // 门幅单位固定 cm；排料长度单位固定 m
        widthCm: Number.isFinite(item.widthCm) ? item.widthCm : 0,
        markerLengthM: Number.isFinite(item.markerLengthM) ? item.markerLengthM : 0,
        // totalPieceCount 固定语义：裁片总片数
        totalPieceCount:
          Number.isFinite(item.totalPieceCount) && item.totalPieceCount > 0
            ? item.totalPieceCount
            : inferredPieceCount,
        pieceRows: pieceRows.map((row) => ({
          id: row.id,
          name: row.name,
          count: row.count,
          note: row.note || undefined,
          applicableSkuCodes:
            row.applicableSkuCodes.length > 0 ? [...row.applicableSkuCodes] : undefined,
          sourceType: row.sourceType,
          missingName: row.missingName || undefined,
          missingCount: row.missingCount || undefined,
          sourcePartName: row.sourcePartName || undefined,
          systemPieceName: row.systemPieceName || undefined,
          candidatePartNames:
            row.candidatePartNames && row.candidatePartNames.length > 0
              ? [...row.candidatePartNames]
              : undefined,
          sizeCode: row.sizeCode || undefined,
          quantityText: row.quantityText || undefined,
          annotation: row.annotation || undefined,
          category: row.category || undefined,
          width: row.width,
          height: row.height,
          area: row.area,
          perimeter: row.perimeter,
          geometryHash: row.geometryHash || undefined,
          previewSvg: row.previewSvg || undefined,
          parserStatus: row.parserStatus || undefined,
          machineReadyStatus: row.machineReadyStatus || undefined,
          rawTextLabels:
            row.rawTextLabels && row.rawTextLabels.length > 0 ? [...row.rawTextLabels] : undefined,
        })),
      }
    }),
    processes: state.techniques.map((item, index) => ({
      id: item.id,
      seq: index + 1,
      name: item.technique,
      timeMinutes: Number(item.standardTime) || 0,
      difficulty: mapDifficultyToEnum(item.difficulty),
      qcPoint: '',
    })),
    processEntries: state.techniques.map((item) => ({
      id: item.id,
      entryType: item.entryType,
      stageCode: item.stageCode,
      stageName: item.stage,
      processCode: item.processCode,
      processName: item.process,
      craftCode: item.craftCode || undefined,
      craftName: item.entryType === 'CRAFT' ? item.technique : undefined,
      assignmentGranularity: item.assignmentGranularity,
      ruleSource: item.ruleSource,
      detailSplitMode: item.detailSplitMode,
      detailSplitDimensions: [...item.detailSplitDimensions],
      defaultDocType: item.defaultDocType,
      taskTypeMode: item.taskTypeMode,
      isSpecialCraft: item.isSpecialCraft,
      triggerSource: item.triggerSource || undefined,
      standardTimeMinutes: Number(item.standardTime) || 0,
      timeUnit: item.timeUnit,
      difficulty: mapDifficultyToEnum(item.difficulty),
      remark: item.remark || undefined,
    })),
    bomItems: state.bomItems.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.materialName,
      spec: item.spec,
      colorLabel: item.colorLabel || undefined,
      unitConsumption: Number(item.usage) || 0,
      lossRate: Number(item.lossRate) || 0,
      supplier: '-',
      printRequirement: item.printRequirement || '无',
      dyeRequirement: item.dyeRequirement || '无',
      applicableSkuCodes: dedupeStrings([...(item.applicableSkuCodes ?? [])]),
      linkedPatternIds: dedupeStrings([
        ...(item.linkedPatternIds ?? []),
        ...item.patternPieces
          .map((pieceName) => patternIdByName.get(pieceName) || '')
          .filter((id) => id.trim().length > 0),
      ]),
      usageProcessCodes:
        item.usageProcessCodes.length > 0
          ? dedupeStrings([...item.usageProcessCodes])
          : undefined,
    })),
    materialCostItems: state.materialCostRows.map((row) => ({
      id: `MC-${row.id}`,
      bomItemId: row.id,
      price: Number.parseFloat(row.price) || 0,
      currency: row.currency,
      unit: row.unit,
    })),
    processCostItems: state.processCostRows.map((row) => ({
      id: `PC-${row.id}`,
      processId: row.id,
      price: Number.parseFloat(row.price) || 0,
      currency: row.currency,
      unit: row.unit,
    })),
    customCostItems: state.customCostRows.map((row, index) => ({
      id: row.id,
      name: row.name.trim() || `自定义成本-${index + 1}`,
      price: Number.parseFloat(row.price) || 0,
      currency: row.currency,
      unit: row.unit,
      remark: row.remark.trim() || undefined,
      sort: index + 1,
    })),
    colorMaterialMappings: state.colorMaterialMappings.map((mapping) => ({
      id: mapping.id,
      spuCode: mapping.spuCode,
      colorCode: mapping.colorCode,
      colorName: mapping.colorName,
      status: mapping.status,
      generatedMode: mapping.generatedMode,
      confirmedBy: mapping.confirmedBy.trim() || undefined,
      confirmedAt: mapping.confirmedAt.trim() || undefined,
      remark: mapping.remark.trim() || undefined,
      lines: mapping.lines.map((line) => ({
        id: line.id,
        bomItemId: line.bomItemId.trim() || undefined,
        materialCode: line.materialCode.trim() || undefined,
        materialName: line.materialName,
        materialType:
          line.materialType === '面料' ||
          line.materialType === '辅料' ||
          line.materialType === '半成品' ||
          line.materialType === '包装材料'
            ? line.materialType
            : '其他',
        patternId: line.patternId.trim() || undefined,
        patternName: line.patternName.trim() || undefined,
        pieceId: line.pieceId.trim() || undefined,
        pieceName: line.pieceName.trim() || undefined,
        pieceCountPerUnit:
          Number.isFinite(line.pieceCountPerUnit) && line.pieceCountPerUnit > 0
            ? line.pieceCountPerUnit
            : undefined,
        unit: line.unit,
        applicableSkuCodes:
          line.applicableSkuCodes.length > 0 ? [...line.applicableSkuCodes] : undefined,
        sourceMode: line.sourceMode,
        note: line.note.trim() || undefined,
      })),
    })),
    completenessScore: score,
    missingChecklist: missing,
    lastUpdatedAt: options.touch ? toTimestamp() : state.techPack.lastUpdatedAt,
    lastUpdatedBy: options.touch ? currentUser.name : state.techPack.lastUpdatedBy,
  }

  state.techPack = next

  if (options.persist !== false && state.currentTechnicalVersionId && !state.compatibilityMode) {
    const patch = buildTechnicalContentPatchFromLegacyTechPack(next)
    patch.qualityRules = state.qualityRules.map((item) => ({ ...item }))
    saveTechnicalDataVersionContent(state.currentTechnicalVersionId, patch, currentUser.name)
  }
}

function closeAllDialogs(): void {
  state.releaseDialogOpen = false
  state.addPatternDialogOpen = false
  state.addBomDialogOpen = false
  state.addTechniqueDialogOpen = false
  state.addSizeDialogOpen = false
  state.addQualityDialogOpen = false
  state.addDesignDialogOpen = false
  state.addAttachmentDialogOpen = false
  state.patternDialogOpen = false
}

function buildPatternFormStateFromItem(item: PatternItem): PatternFormState {
  return {
    name: item.name,
    type: item.type,
    image: item.image,
    file: item.file,
    remark: item.remark,
    linkedBomItemId: item.linkedBomItemId,
    widthCm: item.widthCm,
    markerLengthM: item.markerLengthM,
    totalPieceCount: item.totalPieceCount,
    patternMaterialType: item.patternMaterialType,
    patternMaterialTypeLabel: item.patternMaterialTypeLabel,
    patternFileMode: item.patternFileMode,
    parseStatus: item.parseStatus,
    parseStatusLabel: item.parseStatusLabel,
    parseError: item.parseError,
    parsedAt: item.parsedAt,
    dxfFileName: item.dxfFileName,
    dxfFileSize: item.dxfFileSize,
    dxfLastModified: item.dxfLastModified,
    rulFileName: item.rulFileName,
    rulFileSize: item.rulFileSize,
    rulLastModified: item.rulLastModified,
    singlePatternFileName: item.singlePatternFileName,
    singlePatternFileSize: item.singlePatternFileSize,
    singlePatternFileLastModified: item.singlePatternFileLastModified,
    dxfEncoding: item.dxfEncoding,
    rulEncoding: item.rulEncoding,
    rulSizeList: [...item.rulSizeList],
    rulSampleSize: item.rulSampleSize,
    patternSoftwareName: item.patternSoftwareName,
    sizeRange: item.sizeRange,
    pieceRows: item.pieceRows.map((row) => ({
      ...row,
      applicableSkuCodes: [...row.applicableSkuCodes],
      candidatePartNames: [...(row.candidatePartNames ?? [])],
      rawTextLabels: [...(row.rawTextLabels ?? [])],
    })),
    selectedDxfFile: null,
    selectedRulFile: null,
    selectedSinglePatternFile: null,
    patternParsing: false,
  }
}

function resetPatternForm(): void {
  state.newPattern = createEmptyPatternFormState()
  state.editPatternItemId = null
}

function resetBomForm(): void {
  state.editBomItemId = null
  state.newBomItem = {
    type: '面料',
    colorLabel: '',
    materialCode: '',
    materialName: '',
    spec: '',
    patternPieces: [],
    linkedPatternIds: [],
    applicableSkuCodes: [],
    usageProcessCodes: [],
    usage: '',
    lossRate: '',
    printRequirement: '无',
    dyeRequirement: '无',
  }
}

function resetTechniqueForm(): void {
  state.editTechniqueId = null
  state.newTechnique = {
    stageCode: '',
    processCode: '',
    entryType: 'CRAFT',
    baselineProcessCode: '',
    craftCode: '',
    ruleSource: 'INHERIT_PROCESS',
    assignmentGranularity: 'ORDER',
    detailSplitMode: 'COMPOSITE',
    detailSplitDimensions: ['PATTERN', 'MATERIAL_SKU'],
    standardTime: '',
    timeUnit: '分钟/件',
    difficulty: '中等',
    remark: '',
  }
}

function resetSizeForm(): void {
  state.newSizeRow = {
    part: '',
    S: '',
    M: '',
    L: '',
    XL: '',
    tolerance: '',
  }
}

function resetQualityRuleForm(): void {
  resetQualityForm()
}

function resetAttachmentForm(): void {
  state.newAttachment = {
    fileName: '',
    fileType: 'PDF',
    fileSize: '1.0MB',
  }
}

function ensureTechPackPageState(rawSpuCode: string, seed: TechPackPageInitSeed = {}): void {
  const spuCode = decodeSpuCode(rawSpuCode)
  const nextActiveTab = seed.activeTab ?? state.activeTab

  if (seed.technicalVersionId && state.currentTechnicalVersionId === seed.technicalVersionId && state.techPack) {
    state.activeTab = nextActiveTab
    return
  }

  state.loading = true

  const technicalVersionId = seed.technicalVersionId || ''
  const styleId = seed.styleId || ''

  if (technicalVersionId) {
    const record = getTechnicalDataVersionById(technicalVersionId)
    const content = getTechnicalDataVersionContent(technicalVersionId)
    if (record && content) {
      const techPack = buildLegacyTechPackFromTechnicalVersion(record, content)
      applyTechPackState(techPack, {
        ...seed,
        activeTab: nextActiveTab,
        currentSpuCode: record.styleCode || spuCode,
        styleId: styleId || record.styleId,
        technicalVersionId: record.technicalVersionId,
        technicalVersionCode: record.technicalVersionCode,
        qualityRules: content.qualityRules.map((item) => ({ ...item })),
      })
    } else {
      clearTechPackState(spuCode)
    }
  } else {
    clearTechPackState(spuCode)
    state.activeTab = nextActiveTab
  }

  closeAllDialogs()
  resetPatternForm()
  resetBomForm()
  resetTechniqueForm()
  resetSizeForm()
  resetQualityRuleForm()
  resetAttachmentForm()
  state.newDesignName = ''

  state.selectedPattern = null

  state.loading = false
  if (state.techPack) {
    syncTechPackToStore({ touch: false, persist: false })
  }
}

function renderStatusBadge(status: string): string {
  const config = techPackStatusConfig[status] ?? techPackStatusConfig.BETA
  return `<span class="inline-flex rounded border px-2 py-0.5 text-xs ${config.className}">${escapeHtml(config.label)}</span>`
}

function renderChecklist(): string {
  const checklist = getChecklist()
  return checklist
    .map((item) => {
      let label = '未完成'
      let className = 'text-orange-700 border-orange-400 bg-orange-50'

      if (!item.required) {
        label = '可选'
        className = 'text-muted-foreground border-muted-foreground/30'
      } else if (item.done) {
        label = '已完成'
        className = 'text-green-700 border-green-400 bg-green-50'
      }

      return `
        <div class="flex flex-col items-center gap-0.5">
          <span class="text-xs text-muted-foreground">${escapeHtml(item.label)}</span>
          <span class="inline-flex rounded border px-1.5 py-0 text-xs ${className}">${label}</span>
        </div>
      `
    })
    .join('')
}

function renderTabHeader(): string {
  return `
    <div class="grid w-full grid-cols-8 gap-2 rounded-lg border bg-muted/20 p-2">
      ${tabItems
        .map(
          (tab) => `
            <button
              class="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm ${
                state.activeTab === tab.key ? 'bg-background shadow-sm font-medium' : 'hover:bg-muted'
              }"
              data-tech-action="switch-tab"
              data-tab="${tab.key}"
            >
              <i data-lucide="${tab.icon}" class="h-4 w-4"></i>
              ${escapeHtml(tab.label)}
            </button>
          `,
        )
        .join('')}
    </div>
  `
}

function isTechPackReadOnly(): boolean {
  return false
}

export {
  appStore,
  escapeHtml,
  currentUser,
  TECH_PACK_PATTERN_CATEGORY_OPTIONS,
  techPackStatusConfig,
  DETAIL_SPLIT_DIMENSION_LABEL,
  DETAIL_SPLIT_MODE_LABEL,
  PROCESS_ASSIGNMENT_GRANULARITY_LABEL,
  PROCESS_DOC_TYPE_LABEL,
  RULE_SOURCE_LABEL,
  TASK_TYPE_MODE_LABEL,
  tabItems,
  printOptions,
  dyeOptions,
  currencyOptions,
  materialUnitOptions,
  processUnitOptions,
  customCostUnitOptions,
  bomUsageProcessOptions,
  difficultyOptions,
  stageOptions,
  stageCodeToName,
  stageNameToCode,
  baselineProcessOptions,
  craftOptions,
  getTechniqueProcessOptions,
  getTechniqueCraftOptions,
  state,
  isTechPackReadOnly,
  toTimestamp,
  decodeSpuCode,
  cloneTechPack,
  mapDifficultyToZh,
  mapDifficultyToEnum,
  getStageName,
  getBaselineProcessByCode,
  getCraftOptionByCode,
  getTechniqueReferenceMetaByCraftCode,
  getSelectedDraftMeta,
  canEditTechnique,
  dedupeStrings,
  formatDetailSplitDimensionsText,
  formatPatternSpec,
  colorMappingStatusLabel,
  colorMappingStatusClass,
  generatedModeLabel,
  normalizeColorMappingLineRows,
  buildColorMaterialMappings,
  getSkuOptionsForCurrentSpu,
  getSkuCodesByColor,
  getPatternById,
  getPatternPieceById,
  hasDyeDemand,
  hasPrintDemand,
  isBomDrivenPrepTechnique,
  isPrepStage,
  createEmptyMappingLine,
  isComplexColorMappingScenario,
  buildAutoMappingLinesForColor,
  buildSystemSuggestedColorMappings,
  touchMappingAsManual,
  updateColorMapping,
  updateColorMappingLine,
  copySystemDraftToManual,
  resetColorMappingToSystemSuggestion,
  getPatternBySelectionKey,
  normalizePatternPieceRows,
  buildPatternItemsFromTechPack,
  requestTechPackRender,
  getPatternMaterialTypeLabel,
  getPatternParseStatusLabel,
  buildPatternDisplayFile,
  buildPatternFormStateFromItem,
  buildBomItemsFromTechPack,
  toTechniqueItemFromEntry,
  buildTechniquesFromTechPack,
  syncBomDrivenPrepTechniques,
  buildMaterialCostRows,
  buildProcessCostRows,
  buildCustomCostRows,
  syncMaterialCostRows,
  syncProcessCostRows,
  getChecklist,
  syncTechPackToStore,
  closeAllDialogs,
  resetPatternForm,
  resetBomForm,
  resetTechniqueForm,
  resetSizeForm,
  resetQualityRuleForm,
  resetAttachmentForm,
  ensureTechPackPageState,
  renderStatusBadge,
  renderChecklist,
  renderTabHeader,
}

export type {
  TechPackTab,
  DifficultyLevel,
  QualityRuleRow,
  TechniqueItem,
  BaselineProcessOption,
  CraftOption,
  BomItemRow,
  PatternPieceRow,
  SkuOption,
  PatternItem,
  PatternFormState,
  ColorMaterialMappingLineRow,
  ColorMaterialMappingRow,
  MaterialCostRow,
  ProcessCostRow,
  CustomCostRow,
  ChecklistItem,
  TechPackPageState,
  TechPackAssignmentGranularity,
  TechPackColorMappingGeneratedMode,
  TechPackColorMappingStatus,
  TechPackColorMaterialMapping,
  TechPackColorMaterialMappingLine,
  TechPackPatternMaterialType,
  TechPackPatternParseStatus,
  TechPackProcessEntry,
  TechPackProcessEntryType,
  TechPackRuleSource,
  TechPackDetailSplitMode,
  TechPackDetailSplitDimension,
  TechPackSizeRow,
}
