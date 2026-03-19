import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  getOrCreateTechPack,
  updateTechPack,
  type TechPack,
  type TechPackColorMappingGeneratedMode,
  type TechPackColorMappingStatus,
  type TechPackColorMaterialMapping,
  type TechPackColorMaterialMappingLine,
  type TechPackSizeRow,
} from '../data/fcs/tech-packs'
import { productionOrders } from '../data/fcs/production-orders'

type TechPackTab =
  | 'pattern'
  | 'bom'
  | 'process'
  | 'cost'
  | 'color-mapping'
  | 'size'
  | 'design'
  | 'attachments'
type DifficultyLevel = 'LOW' | 'MEDIUM' | 'HIGH'

type QualityCheckItem = {
  id: string
  name: string
  required: boolean
  standard: string
}

type TechniqueItem = {
  id: string
  stage: string
  process: string
  technique: string
  standardTime: number
  timeUnit: string
  difficulty: '简单' | '中等' | '困难'
  enableQualityCheck: boolean
  qualityChecks: QualityCheckItem[]
  remark: string
  source: '老系统同步' | '字典新增'
}

type DictionaryTechnique = {
  name: string
  stdTime: number
  timeUnit: string
  difficulty: TechniqueItem['difficulty']
  checks: string[]
}

type DictionaryProcess = {
  process: string
  techniques: DictionaryTechnique[]
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
}

type SkuOption = {
  skuCode: string
  color: string
  size: string
}

type PatternItem = {
  id: string
  name: string
  type: string
  image: string
  file: string
  remark: string
  linkedBomItemId: string
  widthCm: number
  markerLengthM: number
  totalPieceCount: number
  pieceRows: PatternPieceRow[]
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
  BETA: { label: '测试版', className: 'bg-yellow-100 text-yellow-700' },
  RELEASED: { label: '已发布', className: 'bg-green-100 text-green-700' },
}

const tabItems: Array<{ key: TechPackTab; icon: string; label: string }> = [
  { key: 'bom', icon: 'clipboard-list', label: 'BOM' },
  { key: 'pattern', icon: 'file-text', label: '纸样' },
  { key: 'color-mapping', icon: 'git-merge', label: '款色-物料-纸样-裁片映射' },
  { key: 'process', icon: 'scissors', label: '工序' },
  { key: 'cost', icon: 'dollar-sign', label: '核价' },
  { key: 'size', icon: 'ruler', label: '尺码表' },
  { key: 'design', icon: 'image', label: '花型设计' },
  { key: 'attachments', icon: 'paperclip', label: '附件' },
]

const printOptions = ['无', '数码印', '丝网印', '胶浆印', '烫金', '烫银', '转印', '其他']
const dyeOptions = ['无', '匹染', '成衣染', '扎染', '渐变染', '其他']
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
const timeUnitOptions = ['分钟/件', '分钟/批', '分钟/米', '分钟/打']
const difficultyOptions: Array<TechniqueItem['difficulty']> = ['简单', '中等', '困难']
const stageOptions = ['准备阶段', '生产阶段', '后整阶段']

const dictProcessOptions: Record<string, DictionaryProcess[]> = {
  准备阶段: [
    {
      process: '裁片',
      techniques: [
        {
          name: '排料裁剪（自动）',
          stdTime: 5,
          timeUnit: '分钟/件',
          difficulty: '简单',
          checks: ['裁片尺寸（公差 ±1cm）'],
        },
        {
          name: '手工裁领片',
          stdTime: 8,
          timeUnit: '分钟/件',
          difficulty: '中等',
          checks: ['裁片形状'],
        },
      ],
    },
    {
      process: '特殊工艺',
      techniques: [
        {
          name: '特殊吊牌加固',
          stdTime: 5,
          timeUnit: '分钟/件',
          difficulty: '简单',
          checks: ['加固位置'],
        },
      ],
    },
  ],
  生产阶段: [
    {
      process: '车缝',
      techniques: [
        {
          name: '合肩',
          stdTime: 8,
          timeUnit: '分钟/件',
          difficulty: '中等',
          checks: ['缝合宽度（1cm ±0.2cm）'],
        },
        {
          name: '上领',
          stdTime: 10,
          timeUnit: '分钟/件',
          difficulty: '中等',
          checks: ['领口圆顺度'],
        },
        {
          name: '锁边',
          stdTime: 6,
          timeUnit: '分钟/件',
          difficulty: '简单',
          checks: [],
        },
        {
          name: '拼袖',
          stdTime: 9,
          timeUnit: '分钟/件',
          difficulty: '中等',
          checks: ['袖窿对齐'],
        },
        {
          name: '装拉链',
          stdTime: 12,
          timeUnit: '分钟/件',
          difficulty: '中等',
          checks: ['拉链顺滑度'],
        },
      ],
    },
    {
      process: '印花',
      techniques: [
        {
          name: '数码印花',
          stdTime: 10,
          timeUnit: '分钟/件',
          difficulty: '中等',
          checks: ['印花位置（误差 ≤2mm）', '色牢度（≥4级）'],
        },
        {
          name: '丝网印花',
          stdTime: 12,
          timeUnit: '分钟/件',
          difficulty: '中等',
          checks: ['对位精度'],
        },
      ],
    },
    {
      process: '染色',
      techniques: [
        {
          name: '染缸染色',
          stdTime: 60,
          timeUnit: '分钟/批',
          difficulty: '中等',
          checks: ['色差（≤1级）'],
        },
      ],
    },
    {
      process: '特殊工艺',
      techniques: [
        {
          name: '手工钉珠定位',
          stdTime: 25,
          timeUnit: '分钟/件',
          difficulty: '困难',
          checks: ['珠位偏差（≤1mm）'],
        },
        {
          name: '局部压皱处理',
          stdTime: 18,
          timeUnit: '分钟/件',
          difficulty: '困难',
          checks: ['压皱均匀度'],
        },
      ],
    },
  ],
  后整阶段: [
    {
      process: '整烫',
      techniques: [
        {
          name: '成衣整烫',
          stdTime: 3,
          timeUnit: '分钟/件',
          difficulty: '简单',
          checks: [],
        },
        {
          name: '定型整烫',
          stdTime: 5,
          timeUnit: '分钟/件',
          difficulty: '简单',
          checks: [],
        },
      ],
    },
    {
      process: '水洗',
      techniques: [
        {
          name: '成衣水洗',
          stdTime: 30,
          timeUnit: '分钟/批',
          difficulty: '简单',
          checks: ['缩水率（≤3%）'],
        },
      ],
    },
    {
      process: '包装',
      techniques: [
        {
          name: '成衣包装',
          stdTime: 2,
          timeUnit: '分钟/件',
          difficulty: '简单',
          checks: [],
        },
        {
          name: '礼盒包装',
          stdTime: 5,
          timeUnit: '分钟/件',
          difficulty: '中等',
          checks: [],
        },
      ],
    },
    {
      process: '特殊工艺',
      techniques: [
        {
          name: '特殊吊牌加固',
          stdTime: 5,
          timeUnit: '分钟/件',
          difficulty: '简单',
          checks: [],
        },
      ],
    },
  ],
}

const legacySyncedTechniques = new Set([
  '排料裁剪（自动）',
  '合肩',
  '数码印花',
  '锁边',
  '成衣整烫',
])

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
    pieceRows: [
      { id: 'PAT-001-R1', name: '前片', count: 2, note: '', applicableSkuCodes: [] },
      { id: 'PAT-001-R2', name: '门襟', count: 2, note: '', applicableSkuCodes: [] },
      { id: 'PAT-001-R3', name: '口袋贴', count: 2, note: '可选口袋款', applicableSkuCodes: [] },
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
    pieceRows: [
      { id: 'PAT-002-R1', name: '后片', count: 2, note: '', applicableSkuCodes: [] },
      { id: 'PAT-002-R2', name: '肩部补强片', count: 2, note: '', applicableSkuCodes: [] },
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
    id: 'tech-1',
    stage: '准备阶段',
    process: '裁片',
    technique: '排料裁剪（自动）',
    standardTime: 5,
    timeUnit: '分钟/件',
    difficulty: '简单',
    source: '老系统同步',
    enableQualityCheck: true,
    qualityChecks: [{ id: 'qc-1', name: '裁片尺寸', required: true, standard: '公差 ±1cm' }],
    remark: '自动排料，减少面料损耗',
  },
  {
    id: 'tech-2',
    stage: '生产阶段',
    process: '车缝',
    technique: '合肩',
    standardTime: 8,
    timeUnit: '分钟/件',
    difficulty: '中等',
    source: '老系统同步',
    enableQualityCheck: true,
    qualityChecks: [{ id: 'qc-2', name: '缝合宽度', required: true, standard: '1cm ±0.2cm' }],
    remark: '',
  },
  {
    id: 'tech-3',
    stage: '生产阶段',
    process: '印花',
    technique: '数码印花',
    standardTime: 10,
    timeUnit: '分钟/件',
    difficulty: '中等',
    source: '老系统同步',
    enableQualityCheck: true,
    qualityChecks: [
      { id: 'qc-3', name: '印花位置', required: true, standard: '误差 ≤2mm' },
      { id: 'qc-4', name: '色牢度', required: true, standard: '≥4级' },
    ],
    remark: '图案必须居中，严格按色稿执行',
  },
  {
    id: 'tech-4',
    stage: '生产阶段',
    process: '车缝',
    technique: '锁边',
    standardTime: 6,
    timeUnit: '分钟/件',
    difficulty: '简单',
    source: '老系统同步',
    enableQualityCheck: false,
    qualityChecks: [],
    remark: '',
  },
  {
    id: 'tech-5',
    stage: '生产阶段',
    process: '特殊工艺',
    technique: '手工钉珠定位',
    standardTime: 25,
    timeUnit: '分钟/件',
    difficulty: '困难',
    source: '字典新增',
    enableQualityCheck: true,
    qualityChecks: [{ id: 'qc-5', name: '珠位偏差', required: true, standard: '≤1mm' }],
    remark: '按设计图纸定位，不可机器替代',
  },
  {
    id: 'tech-6',
    stage: '后整阶段',
    process: '整烫',
    technique: '成衣整烫',
    standardTime: 3,
    timeUnit: '分钟/件',
    difficulty: '简单',
    source: '老系统同步',
    enableQualityCheck: false,
    qualityChecks: [],
    remark: '',
  },
  {
    id: 'tech-7',
    stage: '后整阶段',
    process: '特殊工艺',
    technique: '局部压皱处理',
    standardTime: 18,
    timeUnit: '分钟/件',
    difficulty: '困难',
    source: '字典新增',
    enableQualityCheck: true,
    qualityChecks: [{ id: 'qc-6', name: '压皱均匀度', required: true, standard: '目视无明显不均' }],
    remark: '压皱区域参照设计稿',
  },
]

interface TechPackPageState {
  currentSpuCode: string | null
  loading: boolean
  activeTab: TechPackTab
  techPack: TechPack | null

  patternItems: PatternItem[]
  bomItems: BomItemRow[]
  techniques: TechniqueItem[]
  materialCostRows: MaterialCostRow[]
  processCostRows: ProcessCostRow[]
  customCostRows: CustomCostRow[]
  colorMaterialMappings: ColorMaterialMappingRow[]

  releaseDialogOpen: boolean
  addPatternDialogOpen: boolean
  addBomDialogOpen: boolean
  addTechniqueDialogOpen: boolean
  addSizeDialogOpen: boolean
  addDesignDialogOpen: boolean
  addAttachmentDialogOpen: boolean
  patternDialogOpen: boolean

  selectedPattern: string | null

  editPatternItemId: string | null
  editBomItemId: string | null
  newPattern: Omit<PatternItem, 'id'>
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
    stage: string
    process: string
    technique: string
    standardTime: string
    timeUnit: string
    difficulty: TechniqueItem['difficulty']
    enableQualityCheck: boolean
    qualityChecks: QualityCheckItem[]
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
  newDesignName: string
  newAttachment: {
    fileName: string
    fileType: string
    fileSize: string
  }
}

const state: TechPackPageState = {
  currentSpuCode: null,
  loading: true,
  activeTab: 'pattern',
  techPack: null,

  patternItems: [],
  bomItems: [],
  techniques: [],
  materialCostRows: [],
  processCostRows: [],
  customCostRows: [],
  colorMaterialMappings: [],

  releaseDialogOpen: false,
  addPatternDialogOpen: false,
  addBomDialogOpen: false,
  addTechniqueDialogOpen: false,
  addSizeDialogOpen: false,
  addDesignDialogOpen: false,
  addAttachmentDialogOpen: false,
  patternDialogOpen: false,

  selectedPattern: null,

  editPatternItemId: null,
  editBomItemId: null,
  newPattern: {
    name: '',
    type: '主体片',
    image: '',
    file: '',
    remark: '',
    linkedBomItemId: '',
    widthCm: 0,
    markerLengthM: 0,
    totalPieceCount: 0,
    pieceRows: [],
  },
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
    stage: stageOptions[0],
    process: '',
    technique: '',
    standardTime: '',
    timeUnit: '分钟/件',
    difficulty: '中等',
    enableQualityCheck: false,
    qualityChecks: [],
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
  newDesignName: '',
  newAttachment: {
    fileName: '',
    fileType: 'PDF',
    fileSize: '1.0MB',
  },
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

function getTechniqueDictionaryEntry(
  stage: string,
  process: string,
  technique: string,
): DictionaryTechnique | null {
  const processEntry = (dictProcessOptions[stage] ?? []).find((item) => item.process === process)
  if (!processEntry) return null
  return processEntry.techniques.find((item) => item.name === technique) ?? null
}

function mapProcessToStage(name: string): {
  stage: string
  process: string
  source: TechniqueItem['source']
} {
  for (const stage of stageOptions) {
    const processEntries = dictProcessOptions[stage] ?? []
    for (const processEntry of processEntries) {
      const found = processEntry.techniques.find((item) => item.name === name)
      if (found) {
        return {
          stage,
          process: processEntry.process,
          source: legacySyncedTechniques.has(name) ? '老系统同步' : '字典新增',
        }
      }
    }
  }

  if (name.includes('裁') || name.includes('验布') || name.includes('排版')) {
    return { stage: '准备阶段', process: '裁片', source: '老系统同步' }
  }
  if (name.includes('整烫')) {
    return { stage: '后整阶段', process: '整烫', source: '老系统同步' }
  }
  if (name.includes('水洗')) {
    return { stage: '后整阶段', process: '水洗', source: '老系统同步' }
  }
  if (name.includes('包装')) {
    return { stage: '后整阶段', process: '包装', source: '老系统同步' }
  }
  if (name.includes('染')) {
    return { stage: '生产阶段', process: '染色', source: '老系统同步' }
  }
  if (name.includes('印')) {
    return { stage: '生产阶段', process: '印花', source: '老系统同步' }
  }
  if (name.includes('车') || name.includes('缝')) {
    return { stage: '生产阶段', process: '车缝', source: '老系统同步' }
  }
  return { stage: '生产阶段', process: '特殊工艺', source: '老系统同步' }
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((item) => item.trim().length > 0)))
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
    name: row.name || `裁片-${index + 1}`,
    count: Number.isFinite(row.count) ? Number(row.count) : 0,
    note: row.note || '',
    applicableSkuCodes: dedupeStrings([...(row.applicableSkuCodes ?? [])]),
  }))
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
    const normalizedRows = normalizePatternPieceRows(
      (item.pieceRows ?? []).map((row) => ({
        id: row.id || '',
        name: row.name,
        count: Number(row.count),
        note: row.note || '',
        applicableSkuCodes: [...(row.applicableSkuCodes ?? [])],
      })),
      patternId,
    )
    const inferredPieceCount = normalizedRows.reduce((sum, row) => sum + row.count, 0)

    return {
      id: patternId,
      name: item.fileName.replace(/\.[^/.]+$/, ''),
      type: '主体片',
      image: '',
      file: item.fileName,
      remark: '',
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
      printRequirement: '无',
      dyeRequirement: '无',
    }
  })
}

function buildTechniquesFromTechPack(techPack: TechPack): TechniqueItem[] {
  if (techPack.processes.length === 0) {
    return DEFAULT_TECHNIQUES.map((item) => ({
      ...item,
      qualityChecks: item.qualityChecks.map((qc) => ({ ...qc })),
    }))
  }

  return techPack.processes.map((item, index) => {
    const mapped = mapProcessToStage(item.name)
    const dictionaryEntry = getTechniqueDictionaryEntry(mapped.stage, mapped.process, item.name)
    return {
      id: item.id || `tech-${index + 1}`,
      stage: mapped.stage,
      process: mapped.process,
      technique: item.name,
      standardTime: item.timeMinutes,
      timeUnit: dictionaryEntry?.timeUnit ?? '分钟/件',
      difficulty: mapDifficultyToZh(item.difficulty),
      enableQualityCheck: Boolean(item.qcPoint),
      qualityChecks: item.qcPoint
        ? [{ id: `qc-${item.id}`, name: item.qcPoint, required: true, standard: item.qcPoint }]
        : [],
      remark: '',
      source: mapped.source,
    }
  })
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
  const mappingConfirmed =
    state.colorMaterialMappings.length > 0 &&
    state.colorMaterialMappings.every(
      (item) =>
        (item.status === 'CONFIRMED' || item.status === 'AUTO_CONFIRMED') &&
        item.lines.length > 0,
    )

  return [
    { key: 'bom', label: 'BOM', required: true, done: state.bomItems.length > 0 },
    { key: 'pattern', label: '纸样', required: true, done: state.patternItems.length > 0 },
    {
      key: 'color-mapping',
      label: '款色-物料-纸样-裁片映射',
      required: true,
      done: mappingConfirmed,
    },
    { key: 'process', label: '工序', required: true, done: state.techniques.length > 0 },
    { key: 'cost', label: '核价', required: true, done: true },
    { key: 'size', label: '尺码表', required: true, done: state.techPack.sizeTable.length > 0 },
    {
      key: 'design',
      label: '花型设计',
      required: hasDesignRequirement,
      done: state.techPack.patternDesigns.length > 0,
    },
  ]
}

function syncTechPackToStore(options: { touch: boolean } = { touch: true }): void {
  if (!state.techPack) return

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
      return {
        id: item.id,
        fileName: item.file || `${item.name}.dxf`,
        fileUrl: '#',
        uploadedAt: state.techPack?.lastUpdatedAt || toTimestamp(),
        uploadedBy: currentUser.name,
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
        })),
      }
    }),
    processes: state.techniques.map((item, index) => ({
      id: item.id,
      seq: index + 1,
      name: item.technique,
      timeMinutes: Number(item.standardTime) || 0,
      difficulty: mapDifficultyToEnum(item.difficulty),
      qcPoint:
        item.qualityChecks.find((qc) => qc.required)?.name ||
        item.qualityChecks[0]?.name ||
        '',
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
  updateTechPack(next.spuCode, next)
}

function closeAllDialogs(): void {
  state.releaseDialogOpen = false
  state.addPatternDialogOpen = false
  state.addBomDialogOpen = false
  state.addTechniqueDialogOpen = false
  state.addSizeDialogOpen = false
  state.addDesignDialogOpen = false
  state.addAttachmentDialogOpen = false
  state.patternDialogOpen = false
}

function resetPatternForm(): void {
  state.newPattern = {
    name: '',
    type: '主体片',
    image: '',
    file: '',
    remark: '',
    linkedBomItemId: '',
    widthCm: 0,
    markerLengthM: 0,
    totalPieceCount: 0,
    pieceRows: [],
  }
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

function resetTechniqueForm(defaultStage: string = stageOptions[0]): void {
  state.newTechnique = {
    stage: defaultStage,
    process: '',
    technique: '',
    standardTime: '',
    timeUnit: '分钟/件',
    difficulty: '中等',
    enableQualityCheck: false,
    qualityChecks: [],
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

function resetAttachmentForm(): void {
  state.newAttachment = {
    fileName: '',
    fileType: 'PDF',
    fileSize: '1.0MB',
  }
}

function ensureTechPackPageState(rawSpuCode: string): void {
  const spuCode = decodeSpuCode(rawSpuCode)

  if (state.currentSpuCode === spuCode && state.techPack) {
    return
  }

  state.loading = true

  const techPack = cloneTechPack(getOrCreateTechPack(spuCode, spuCode))
  state.currentSpuCode = spuCode
  state.techPack = techPack
  state.activeTab = 'pattern'

  state.patternItems = buildPatternItemsFromTechPack(techPack)
  state.bomItems = buildBomItemsFromTechPack(techPack)
  state.techniques = buildTechniquesFromTechPack(techPack)
  state.materialCostRows = buildMaterialCostRows(state.bomItems, techPack)
  state.processCostRows = buildProcessCostRows(state.techniques, techPack)
  state.customCostRows = buildCustomCostRows(techPack)
  const loadedMappings = buildColorMaterialMappings(techPack)
  state.colorMaterialMappings =
    loadedMappings.length > 0 ? loadedMappings : buildSystemSuggestedColorMappings()

  closeAllDialogs()
  resetPatternForm()
  resetBomForm()
  resetTechniqueForm()
  resetSizeForm()
  resetAttachmentForm()
  state.newDesignName = ''

  state.selectedPattern = null

  state.loading = false
  syncTechPackToStore({ touch: false })
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

function renderPatternTab(): string {
  const bomById = new Map(state.bomItems.map((item) => [item.id, item]))

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <h3 class="text-base font-semibold">纸样</h3>
        <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-pattern">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加纸样
        </button>
      </header>
      <div class="p-4">
        ${
          state.patternItems.length === 0
            ? '<div class="rounded-lg border py-8 text-center text-muted-foreground">暂无纸样</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">纸样名称</th>
                    <th class="px-3 py-2 text-left">类型</th>
                    <th class="px-3 py-2 text-left">关联物料</th>
                    <th class="px-3 py-2 text-left">规格</th>
                    <th class="px-3 py-2 text-right">裁片总片数</th>
                    <th class="px-3 py-2 text-left">裁片明细</th>
                    <th class="px-3 py-2 text-left">文件</th>
                    <th class="px-3 py-2 text-left">备注</th>
                    <th class="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.patternItems
                    .map(
                      (item) => {
                        const linkedBom = item.linkedBomItemId ? bomById.get(item.linkedBomItemId) : null
                        const linkedBomLabel = linkedBom
                          ? `${linkedBom.materialCode} · ${linkedBom.materialName}`
                          : '未关联'
                        const pieceCount =
                          Number.isFinite(item.totalPieceCount) && item.totalPieceCount > 0
                            ? item.totalPieceCount
                            : item.pieceRows.reduce((sum, row) => sum + row.count, 0)

                        return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.name)}</td>
                          <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.type)}</span></td>
                          <td class="px-3 py-2 text-sm ${linkedBom ? '' : 'text-muted-foreground'}">
                            ${escapeHtml(linkedBomLabel)}
                          </td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(formatPatternSpec(item.widthCm, item.markerLengthM))}</td>
                          <td class="px-3 py-2 text-right">${pieceCount} 片</td>
                          <td class="px-3 py-2">
                            ${
                              item.pieceRows.length > 0
                                ? `<button class="text-blue-600 hover:underline" data-tech-action="open-pattern-detail" data-pattern-id="${item.id}">${item.pieceRows.length} 项明细</button>`
                                : '<span class="text-sm text-muted-foreground">暂无</span>'
                            }
                          </td>
                          <td class="px-3 py-2">
                            ${
                              item.file
                                ? `<button class="text-blue-600 hover:underline" data-tech-action="noop">${escapeHtml(item.file)}</button>`
                                : '<span class="text-sm text-muted-foreground">无</span>'
                            }
                          </td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.remark || '-')}</td>
                          <td class="px-3 py-2">
                            <div class="flex items-center gap-1">
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-pattern" data-pattern-id="${item.id}">
                                <i data-lucide="edit-2" class="h-4 w-4"></i>
                              </button>
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="open-pattern-detail" data-pattern-id="${item.id}">
                                <i data-lucide="eye" class="h-4 w-4"></i>
                              </button>
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-pattern" data-pattern-id="${item.id}">
                                <i data-lucide="trash-2" class="h-4 w-4"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `
                      },
                    )
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

function renderProcessTechniqueCard(item: TechniqueItem): string {
  return `
    <article class="space-y-3">
      <div class="mb-3 flex items-start justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm font-medium">${escapeHtml(item.process)}</span>
          <span class="text-sm text-muted-foreground">·</span>
          <span class="text-sm">${escapeHtml(item.technique)}</span>
          <span class="inline-flex rounded border px-1.5 py-0 text-[10px] font-medium ${
            item.source === '老系统同步'
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }">${escapeHtml(item.source)}</span>
        </div>
        <button class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-technique" data-tech-id="${item.id}">
          <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
        </button>
      </div>

      <div class="mb-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
        <label>
          <span class="text-xs text-muted-foreground">标准工时</span>
          <div class="mt-1 flex items-center gap-1">
            <input
              type="number"
              class="h-8 w-20 rounded-md border px-2 text-sm"
              value="${item.standardTime}"
              data-tech-field="tech-standard-time"
              data-tech-id="${item.id}"
            />
            <select
              class="h-8 w-24 rounded-md border px-2 text-sm"
              data-tech-field="tech-time-unit"
              data-tech-id="${item.id}"
            >
              ${timeUnitOptions
                .map((option) => `<option value="${option}" ${item.timeUnit === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
          </div>
        </label>

        <label>
          <span class="text-xs text-muted-foreground">难度</span>
          <select class="mt-1 h-8 w-full rounded-md border px-2 text-sm" data-tech-field="tech-difficulty" data-tech-id="${item.id}">
            ${difficultyOptions.map((option) => `<option value="${option}" ${item.difficulty === option ? 'selected' : ''}>${option}</option>`).join('')}
          </select>
        </label>

        <label class="inline-flex items-end gap-2 pb-0.5">
          <input type="checkbox" data-tech-field="tech-enable-qc" data-tech-id="${item.id}" ${item.enableQualityCheck ? 'checked' : ''} />
          <span class="text-xs">安排质检</span>
        </label>
      </div>

      ${
        item.enableQualityCheck
          ? `
            <div class="mb-3 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs text-muted-foreground">检查项</span>
                <button class="inline-flex items-center rounded px-2 py-1 text-xs hover:bg-muted" data-tech-action="add-quality-check" data-tech-id="${item.id}">
                  <i data-lucide="plus" class="mr-1 h-3 w-3"></i>
                  新增
                </button>
              </div>
              ${
                item.qualityChecks.length > 0
                  ? `
                    <table class="w-full rounded-md border text-xs">
                      <thead>
                        <tr class="border-b bg-muted/20">
                          <th class="px-2 py-1 text-left">检查项名称</th>
                          <th class="px-2 py-1 text-left">必检</th>
                          <th class="px-2 py-1 text-left">标准要求</th>
                          <th class="px-2 py-1 text-left"></th>
                        </tr>
                      </thead>
                      <tbody>
                        ${item.qualityChecks
                          .map(
                            (qc) => `
                              <tr class="border-b last:border-0">
                                <td class="px-2 py-1">
                                  <input
                                    class="h-7 w-full rounded border px-2 text-xs"
                                    value="${escapeHtml(qc.name)}"
                                    placeholder="检查项名称"
                                    data-tech-field="qc-name"
                                    data-tech-id="${item.id}"
                                    data-qc-id="${qc.id}"
                                  />
                                </td>
                                <td class="px-2 py-1">
                                  <input
                                    type="checkbox"
                                    data-tech-field="qc-required"
                                    data-tech-id="${item.id}"
                                    data-qc-id="${qc.id}"
                                    ${qc.required ? 'checked' : ''}
                                  />
                                </td>
                                <td class="px-2 py-1">
                                  <input
                                    class="h-7 w-full rounded border px-2 text-xs"
                                    value="${escapeHtml(qc.standard)}"
                                    placeholder="标准要求"
                                    data-tech-field="qc-standard"
                                    data-tech-id="${item.id}"
                                    data-qc-id="${qc.id}"
                                  />
                                </td>
                                <td class="px-2 py-1">
                                  <button class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-quality-check" data-tech-id="${item.id}" data-qc-id="${qc.id}">
                                    <i data-lucide="trash-2" class="h-3 w-3"></i>
                                  </button>
                                </td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  `
                  : ''
              }
            </div>
          `
          : ''
      }

      <label>
        <span class="text-xs text-muted-foreground">备注</span>
        <textarea
          rows="2"
          class="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          placeholder="备注信息"
          data-tech-field="tech-remark"
          data-tech-id="${item.id}"
        >${escapeHtml(item.remark)}</textarea>
      </label>
    </article>
  `
}

function renderProcessTab(): string {
  return `
    <section class="space-y-4">
      <header class="rounded-lg border bg-card px-4 py-3">
        <h3 class="text-base font-semibold">工序</h3>
        <p class="mt-1 text-sm text-muted-foreground">阶段 → 工序 → 工艺</p>
      </header>
      <div class="space-y-6">
        ${stageOptions
          .map((stage) => {
            const stageItems = state.techniques.filter((item) => item.stage === stage)
            return `
              <section class="rounded-lg border bg-card">
                <header class="flex items-center justify-between px-4 py-3">
                  <h4 class="text-base font-semibold">${escapeHtml(stage)}</h4>
                  <button
                    class="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted"
                    data-tech-action="open-add-technique"
                    data-stage="${escapeHtml(stage)}"
                  >
                    <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>
                    新增工序工艺
                  </button>
                </header>
                <div class="px-4 pb-4">
                  ${
                    stageItems.length === 0
                      ? `
                        <div class="space-y-2 py-6 text-center text-muted-foreground">
                          <p class="text-sm">暂无工序工艺</p>
                          <button
                            class="inline-flex items-center rounded px-2 py-1 text-xs hover:bg-muted"
                            data-tech-action="open-add-technique"
                            data-stage="${escapeHtml(stage)}"
                          >
                            <i data-lucide="plus" class="mr-1 h-3.5 w-3.5"></i>
                            新增工序工艺
                          </button>
                        </div>
                      `
                      : `
                        <div class="divide-y">
                          ${stageItems
                            .map(
                              (item) => `
                                <div class="py-4 first:pt-0 last:pb-0">
                                  ${renderProcessTechniqueCard(item)}
                                </div>
                              `,
                            )
                            .join('')}
                        </div>
                      `
                  }
                </div>
              </section>
            `
          })
          .join('')}
      </div>
    </section>
  `
}

function renderSizeTab(): string {
  const techPack = state.techPack
  if (!techPack) return ''

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">尺码表</h3>
          <p class="mt-1 text-sm text-muted-foreground">各部位尺寸规格定义</p>
        </div>
        <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-size">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加部位
        </button>
      </header>
      <div class="p-4">
        ${
          techPack.sizeTable.length === 0
            ? '<div class="py-8 text-center text-muted-foreground">暂无数据</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">部位</th>
                    <th class="px-3 py-2 text-right">S</th>
                    <th class="px-3 py-2 text-right">M</th>
                    <th class="px-3 py-2 text-right">L</th>
                    <th class="px-3 py-2 text-right">XL</th>
                    <th class="px-3 py-2 text-right">公差(±)</th>
                    <th class="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${techPack.sizeTable
                    .map(
                      (row) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(row.part)}</td>
                          <td class="px-3 py-2 text-right">${row.S}</td>
                          <td class="px-3 py-2 text-right">${row.M}</td>
                          <td class="px-3 py-2 text-right">${row.L}</td>
                          <td class="px-3 py-2 text-right">${row.XL}</td>
                          <td class="px-3 py-2 text-right">${row.tolerance}</td>
                          <td class="px-3 py-2 text-right">
                            <button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-size" data-size-id="${row.id}">
                              <i data-lucide="trash-2" class="h-4 w-4"></i>
                            </button>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

function renderBomTab(): string {
  const spuLabel = state.techPack?.spuCode || '-'
  const skuOptions = getSkuOptionsForCurrentSpu()
  const skuByCode = new Map(skuOptions.map((item) => [item.skuCode, item]))
  const deriveColorLabel = (item: BomItemRow): string => {
    if (item.colorLabel.trim()) return item.colorLabel.trim()
    if (item.applicableSkuCodes.length === 0) return '全部SKU（当前未区分颜色）'
    const colors = dedupeStrings(
      item.applicableSkuCodes
        .map((skuCode) => skuByCode.get(skuCode)?.color || '')
        .filter((color) => color.trim().length > 0),
    )
    if (colors.length === 1) return colors[0]
    if (colors.length > 1) return '多颜色'
    return '未识别颜色'
  }

  type BomColorGroup = {
    groupKey: string
    colorLabel: string
    skuCodes: string[]
    rows: BomItemRow[]
  }

  const groupsByColor = new Map<string, BomColorGroup>()
  state.bomItems.forEach((item) => {
    const colorLabel = deriveColorLabel(item)
    const groupKey = colorLabel
    const current = groupsByColor.get(groupKey)
    if (current) {
      current.rows.push(item)
      current.skuCodes = dedupeStrings([...current.skuCodes, ...item.applicableSkuCodes])
      return
    }
    groupsByColor.set(groupKey, {
      groupKey,
      colorLabel,
      skuCodes: [...item.applicableSkuCodes],
      rows: [item],
    })
  })
  const groups = Array.from(groupsByColor.values()).sort((a, b) => {
    if (a.colorLabel.startsWith('全部')) return -1
    if (b.colorLabel.startsWith('全部')) return 1
    return a.colorLabel.localeCompare(b.colorLabel)
  })
  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">BOM</h3>
          <p class="mt-1 text-sm text-muted-foreground">按 SKU 分组展示物料清单，便于按颜色/规格查看对应物料</p>
        </div>
        <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-bom">
          <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
          添加物料
        </button>
      </header>
      <div class="p-4">
        ${
          state.bomItems.length === 0
            ? '<div class="py-8 text-center text-muted-foreground">暂无数据</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">SPU</th>
                    <th class="px-3 py-2 text-left">颜色</th>
                    <th class="px-3 py-2 text-left">类型</th>
                    <th class="px-3 py-2 text-left">物料编码</th>
                    <th class="px-3 py-2 text-left">物料名称</th>
                    <th class="px-3 py-2 text-left">规格</th>
                    <th class="px-3 py-2 text-right">单位用量</th>
                    <th class="px-3 py-2 text-right">损耗率(%)</th>
                    <th class="px-3 py-2 text-left">印花需求</th>
                    <th class="px-3 py-2 text-left">染色需求</th>
                    <th class="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${groups
                    .map(
                      (group) => {
                        if (group.rows.length === 0) {
                          return `
                            <tr class="border-b last:border-0 bg-muted/10">
                              <td class="px-3 py-2 font-medium">${escapeHtml(spuLabel)}</td>
                              <td class="px-3 py-2 text-sm">${escapeHtml(group.colorLabel)}</td>
                              <td colspan="9" class="px-3 py-2 text-sm text-muted-foreground">当前 SKU 暂无适用物料</td>
                            </tr>
                          `
                        }

                        return group.rows
                          .map((item, rowIndex) => {
                            return `
                              <tr class="border-b last:border-0">
                                ${
                                  rowIndex === 0
                                    ? `<td rowspan="${group.rows.length}" class="px-3 py-2 align-top font-medium">${escapeHtml(spuLabel)}</td>
                                       <td rowspan="${group.rows.length}" class="px-3 py-2 align-top text-sm">
                                         <div class="space-y-1">
                                           <div>${escapeHtml(group.colorLabel)}</div>
                                           ${
                                             group.skuCodes.length > 0
                                               ? `<div class="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                                    ${group.skuCodes
                                                      .map((skuCode) => {
                                                        const sku = skuByCode.get(skuCode)
                                                        const sizeLabel = sku?.size ? `/${sku.size}` : ''
                                                        return `<span class="inline-flex rounded border px-1.5 py-0.5">${escapeHtml(`${skuCode}${sizeLabel}`)}</span>`
                                                      })
                                                      .join('')}
                                                  </div>`
                                               : '<div class="text-[11px] text-muted-foreground">全部 SKU</div>'
                                           }
                                         </div>
                                       </td>`
                                    : ''
                                }
                                <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.type)}</span></td>
                                <td class="px-3 py-2 font-mono text-sm">${escapeHtml(item.materialCode)}</td>
                                <td class="px-3 py-2 font-medium">${escapeHtml(item.materialName)}</td>
                                <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.spec || '-')}</td>
                                <td class="px-3 py-2 text-right">${item.usage}</td>
                                <td class="px-3 py-2 text-right">${item.lossRate}%</td>
                                <td class="px-3 py-2">
                                  <select class="h-8 w-24 rounded-md border px-2 text-sm" data-tech-field="bom-print" data-bom-id="${item.id}">
                                    ${printOptions
                                      .map((option) => `<option value="${option}" ${item.printRequirement === option ? 'selected' : ''}>${option}</option>`)
                                      .join('')}
                                  </select>
                                </td>
                                <td class="px-3 py-2">
                                  <select class="h-8 w-24 rounded-md border px-2 text-sm" data-tech-field="bom-dye" data-bom-id="${item.id}">
                                    ${dyeOptions
                                      .map((option) => `<option value="${option}" ${item.dyeRequirement === option ? 'selected' : ''}>${option}</option>`)
                                      .join('')}
                                  </select>
                                </td>
                                <td class="px-3 py-2">
                                  <div class="flex items-center gap-1">
                                    <button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="edit-bom" data-bom-id="${item.id}">
                                      <i data-lucide="edit-2" class="h-4 w-4"></i>
                                    </button>
                                    <button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-bom" data-bom-id="${item.id}">
                                      <i data-lucide="trash-2" class="h-4 w-4"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            `
                          })
                          .join('')
                      },
                    )
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

function renderCostTab(): string {
  const materialTotal = state.materialCostRows.reduce(
    (sum, row) => sum + row.usage * (Number.parseFloat(row.price) || 0),
    0,
  )
  const processTotal = state.processCostRows.reduce(
    (sum, row) => sum + (Number.parseFloat(row.price) || 0),
    0,
  )
  const customTotal = state.customCostRows.reduce(
    (sum, row) => sum + (Number.parseFloat(row.price) || 0),
    0,
  )
  const grandTotal = materialTotal + processTotal + customTotal

  return `
    <div class="space-y-6">
      <section class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">物料标准成本</h3>
        </header>
        <div class="p-4">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/30">
                <th class="px-3 py-2 text-left">物料名称</th>
                <th class="px-3 py-2 text-left">规格</th>
                <th class="px-3 py-2 text-right">单位用量</th>
                <th class="px-3 py-2 text-left">标准单价</th>
                <th class="px-3 py-2 text-left">币种</th>
                <th class="px-3 py-2 text-left">单位</th>
                <th class="px-3 py-2 text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              ${state.materialCostRows
                .map(
                  (row) => `
                    <tr class="border-b last:border-0">
                      <td class="px-3 py-2 font-medium">${escapeHtml(row.materialName)}</td>
                      <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(row.spec || '-')}</td>
                      <td class="px-3 py-2 text-right">${row.usage}</td>
                      <td class="px-3 py-2">
                        <input class="h-8 w-24 rounded border px-2 text-sm" type="number" value="${escapeHtml(row.price)}" placeholder="0.00" data-tech-field="material-price" data-row-id="${row.id}" />
                      </td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-24 rounded border px-2 text-sm" data-tech-field="material-currency" data-row-id="${row.id}">
                          ${currencyOptions
                            .map((option) => `<option value="${option}" ${row.currency === option ? 'selected' : ''}>${option}</option>`)
                            .join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-32 rounded border px-2 text-sm" data-tech-field="material-unit" data-row-id="${row.id}">
                          ${materialUnitOptions
                            .map((option) => `<option value="${option}" ${row.unit === option ? 'selected' : ''}>${option}</option>`)
                            .join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2 text-right font-medium">${(row.usage * (Number.parseFloat(row.price) || 0)).toFixed(2)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">工序标准成本</h3>
        </header>
        <div class="p-4">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b bg-muted/30">
                <th class="px-3 py-2 text-left">阶段</th>
                <th class="px-3 py-2 text-left">工序</th>
                <th class="px-3 py-2 text-left">工艺</th>
                <th class="px-3 py-2 text-left">标准单价</th>
                <th class="px-3 py-2 text-left">币种</th>
                <th class="px-3 py-2 text-left">单位</th>
                <th class="px-3 py-2 text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              ${state.processCostRows
                .map(
                  (row) => `
                    <tr class="border-b last:border-0">
                      <td class="px-3 py-2">${escapeHtml(row.stage)}</td>
                      <td class="px-3 py-2">${escapeHtml(row.process)}</td>
                      <td class="px-3 py-2 font-medium">${escapeHtml(row.technique)}</td>
                      <td class="px-3 py-2">
                        <input class="h-8 w-24 rounded border px-2 text-sm" type="number" value="${escapeHtml(row.price)}" placeholder="0.00" data-tech-field="process-price" data-row-id="${row.id}" />
                      </td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-24 rounded border px-2 text-sm" data-tech-field="process-currency" data-row-id="${row.id}">
                          ${currencyOptions
                            .map((option) => `<option value="${option}" ${row.currency === option ? 'selected' : ''}>${option}</option>`)
                            .join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2">
                        <select class="h-8 w-32 rounded border px-2 text-sm" data-tech-field="process-unit" data-row-id="${row.id}">
                          ${processUnitOptions
                            .map((option) => `<option value="${option}" ${row.unit === option ? 'selected' : ''}>${option}</option>`)
                            .join('')}
                        </select>
                      </td>
                      <td class="px-3 py-2 text-right font-medium">${(Number.parseFloat(row.price) || 0).toFixed(2)}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="flex items-center justify-between border-b px-4 py-3">
          <h3 class="text-base font-semibold">自定义成本项</h3>
          <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="add-custom-cost">
            <i data-lucide="plus" class="mr-2 h-4 w-4"></i>
            添加成本项
          </button>
        </header>
        <div class="p-4">
          ${
            state.customCostRows.length === 0
              ? '<div class="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">暂无自定义成本项，可点击“添加成本项”补充开版费、包装补贴等</div>'
              : `
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b bg-muted/30">
                      <th class="px-3 py-2 text-left">成本项名称</th>
                      <th class="px-3 py-2 text-left">标准单价</th>
                      <th class="px-3 py-2 text-left">币种</th>
                      <th class="px-3 py-2 text-left">单位</th>
                      <th class="px-3 py-2 text-left">备注</th>
                      <th class="px-3 py-2 text-right">金额</th>
                      <th class="px-3 py-2 text-left">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${state.customCostRows
                      .map(
                        (row) => `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-2">
                              <input class="h-8 w-44 rounded border px-2 text-sm" value="${escapeHtml(row.name)}" placeholder="例如 开版费分摊" data-tech-field="custom-cost-name" data-row-id="${row.id}" />
                            </td>
                            <td class="px-3 py-2">
                              <input class="h-8 w-24 rounded border px-2 text-sm" type="number" value="${escapeHtml(row.price)}" placeholder="0.00" data-tech-field="custom-cost-price" data-row-id="${row.id}" />
                            </td>
                            <td class="px-3 py-2">
                              <select class="h-8 w-24 rounded border px-2 text-sm" data-tech-field="custom-cost-currency" data-row-id="${row.id}">
                                ${currencyOptions
                                  .map((option) => `<option value="${option}" ${row.currency === option ? 'selected' : ''}>${option}</option>`)
                                  .join('')}
                              </select>
                            </td>
                            <td class="px-3 py-2">
                              <select class="h-8 w-32 rounded border px-2 text-sm" data-tech-field="custom-cost-unit" data-row-id="${row.id}">
                                ${customCostUnitOptions
                                  .map((option) => `<option value="${option}" ${row.unit === option ? 'selected' : ''}>${option}</option>`)
                                  .join('')}
                              </select>
                            </td>
                            <td class="px-3 py-2">
                              <input class="h-8 w-48 rounded border px-2 text-sm" value="${escapeHtml(row.remark || '')}" placeholder="备注（可选）" data-tech-field="custom-cost-remark" data-row-id="${row.id}" />
                            </td>
                            <td class="px-3 py-2 text-right font-medium">${(Number.parseFloat(row.price) || 0).toFixed(2)}</td>
                            <td class="px-3 py-2">
                              <button class="inline-flex h-8 w-8 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-custom-cost" data-row-id="${row.id}">
                                <i data-lucide="trash-2" class="h-4 w-4"></i>
                              </button>
                            </td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              `
          }
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-2 pt-4 text-sm text-muted-foreground">物料标准成本</header>
          <div class="px-4 pb-4">
            <p class="text-2xl font-semibold">${materialTotal.toFixed(2)}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-2 pt-4 text-sm text-muted-foreground">工序标准成本</header>
          <div class="px-4 pb-4">
            <p class="text-2xl font-semibold">${processTotal.toFixed(2)}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-2 pt-4 text-sm text-muted-foreground">自定义成本</header>
          <div class="px-4 pb-4">
            <p class="text-2xl font-semibold">${customTotal.toFixed(2)}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card">
          <header class="px-4 pb-2 pt-4 text-sm text-muted-foreground">总成本</header>
          <div class="px-4 pb-4">
            <p class="text-2xl font-semibold text-blue-700">${grandTotal.toFixed(2)}</p>
          </div>
        </article>
      </section>
    </div>
  `
}

function renderColorMappingTab(): string {
  if (!state.techPack) return ''

  const mappings = state.colorMaterialMappings
  const bomOptions = state.bomItems
  const patternOptions = state.patternItems
  const skuOptions = getSkuOptionsForCurrentSpu()
  const skuLabelByCode = new Map(
    skuOptions.map((item) => [item.skuCode, `${item.color}/${item.size}（${item.skuCode}）`]),
  )
  const totalLineCount = mappings.reduce((sum, item) => sum + item.lines.length, 0)
  const autoDraftCount = mappings.filter((item) => item.status === 'AUTO_DRAFT').length
  const confirmedCount = mappings.filter(
    (item) => item.status === 'CONFIRMED' || item.status === 'AUTO_CONFIRMED',
  ).length
  const manualAdjustedCount = mappings.filter((item) => item.status === 'MANUAL_ADJUSTED').length

  return `
    <div class="space-y-4">
      <section class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">映射颜色数</p>
          <p class="mt-1 text-2xl font-semibold">${mappings.length}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">映射明细行</p>
          <p class="mt-1 text-2xl font-semibold">${totalLineCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">待人工确认</p>
          <p class="mt-1 text-2xl font-semibold text-amber-700">${autoDraftCount}</p>
        </article>
        <article class="rounded-lg border bg-card p-3">
          <p class="text-xs text-muted-foreground">已确认 / 人工调整</p>
          <p class="mt-1 text-2xl font-semibold text-green-700">${confirmedCount + manualAdjustedCount}</p>
        </article>
      </section>

      <section class="rounded-lg border bg-card">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">款色-物料-纸样-裁片映射</h3>
          <p class="mt-1 text-sm text-muted-foreground">用于明确 SPU + 颜色下，单件成衣所需物料、纸样与裁片明细。复杂款自动生成后需人工确认。</p>
        </header>
        <div class="space-y-4 p-4">
          ${
            mappings.length === 0
              ? '<div class="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">当前技术包暂无款色映射，可先完善 BOM / 纸样后由系统生成草稿</div>'
              : mappings
                  .map((mapping) => {
                    const statusLabel = colorMappingStatusLabel[mapping.status]
                    const statusClass = colorMappingStatusClass[mapping.status]

                    return `
                      <article class="rounded-lg border">
                        <header class="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-sm font-semibold">${escapeHtml(`${mapping.colorName}（${mapping.colorCode}）`)}</span>
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusClass}">${escapeHtml(statusLabel)}</span>
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs text-muted-foreground">${escapeHtml(generatedModeLabel[mapping.generatedMode])}</span>
                          </div>
                          <div class="flex flex-wrap items-center gap-2">
                            <button
                              class="inline-flex h-7 items-center rounded border px-2 text-xs hover:bg-muted ${
                                mapping.status === 'AUTO_DRAFT' || mapping.status === 'MANUAL_ADJUSTED'
                                  ? ''
                                  : 'pointer-events-none opacity-50'
                              }"
                              data-tech-action="confirm-color-mapping"
                              data-mapping-id="${mapping.id}"
                            >
                              确认映射
                            </button>
                            <button
                              class="inline-flex h-7 items-center rounded border px-2 text-xs hover:bg-muted"
                              data-tech-action="copy-system-draft-manual"
                              data-mapping-id="${mapping.id}"
                            >
                              复制系统稿为人工版
                            </button>
                            <button
                              class="inline-flex h-7 items-center rounded border px-2 text-xs hover:bg-muted"
                              data-tech-action="add-mapping-line"
                              data-mapping-id="${mapping.id}"
                            >
                              新增映射行
                            </button>
                            <button
                              class="inline-flex h-7 items-center rounded border px-2 text-xs hover:bg-muted"
                              data-tech-action="reset-color-mapping-suggestion"
                              data-mapping-id="${mapping.id}"
                            >
                              重置为系统建议
                            </button>
                          </div>
                        </header>
                        <div class="space-y-2 p-3">
                          <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>SPU：${escapeHtml(mapping.spuCode)}</span>
                            <span>确认人：${escapeHtml(mapping.confirmedBy || '-')}</span>
                            <span>确认时间：${escapeHtml(mapping.confirmedAt || '-')}</span>
                          </div>
                          <div class="rounded border bg-muted/20 px-2 py-1.5">
                            <label class="block text-[11px] text-muted-foreground">映射备注</label>
                            <input
                              class="mt-1 h-7 w-full rounded border bg-background px-2 text-xs"
                              value="${escapeHtml(mapping.remark || '')}"
                              placeholder="可记录系统草稿说明、人工修订原因"
                              data-tech-field="mapping-remark"
                              data-mapping-id="${mapping.id}"
                            />
                          </div>
                          <div class="overflow-x-auto rounded border">
                            <table class="w-full text-xs">
                              <thead>
                                <tr class="border-b bg-muted/20">
                                  <th class="px-2 py-1 text-left">物料（BOM）</th>
                                  <th class="px-2 py-1 text-left">纸样</th>
                                  <th class="px-2 py-1 text-left">裁片</th>
                                  <th class="px-2 py-1 text-right">单件片数</th>
                                  <th class="px-2 py-1 text-left">适用 SKU</th>
                                  <th class="px-2 py-1 text-left">来源</th>
                                  <th class="px-2 py-1 text-left">备注</th>
                                  <th class="px-2 py-1 text-left">操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${
                                  mapping.lines.length === 0
                                    ? '<tr><td colspan="8" class="px-2 py-4 text-center text-muted-foreground">暂无映射明细</td></tr>'
                                    : mapping.lines
                                        .map(
                                          (line) => {
                                            const pieceOptions = line.patternId
                                              ? getPatternById(line.patternId)?.pieceRows ?? []
                                              : []
                                            return `
                                            <tr class="border-b last:border-0">
                                              <td class="px-2 py-1.5">
                                                <div class="grid gap-1">
                                                  <select
                                                    class="h-7 rounded border px-2 text-xs"
                                                    data-tech-field="mapping-line-bom-item"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                  >
                                                    <option value="">未绑定BOM</option>
                                                    ${bomOptions
                                                      .map(
                                                        (bom) => `<option value="${bom.id}" ${line.bomItemId === bom.id ? 'selected' : ''}>${escapeHtml(`${bom.materialCode || bom.id} · ${bom.materialName}`)}</option>`,
                                                      )
                                                      .join('')}
                                                  </select>
                                                  <input
                                                    class="h-7 rounded border px-2 text-xs"
                                                    value="${escapeHtml(line.materialName)}"
                                                    placeholder="物料名称"
                                                    data-tech-field="mapping-line-material-name"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                  />
                                                  <input
                                                    class="h-7 rounded border px-2 text-[11px] text-muted-foreground"
                                                    value="${escapeHtml(line.materialCode || '')}"
                                                    placeholder="物料编码"
                                                    data-tech-field="mapping-line-material-code"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                  />
                                                </div>
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <select
                                                  class="h-7 min-w-[150px] rounded border px-2 text-xs"
                                                  data-tech-field="mapping-line-pattern-id"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                >
                                                  <option value="">未绑定纸样</option>
                                                  ${patternOptions
                                                    .map(
                                                      (pattern) => `<option value="${pattern.id}" ${line.patternId === pattern.id ? 'selected' : ''}>${escapeHtml(pattern.name)}</option>`,
                                                    )
                                                    .join('')}
                                                </select>
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <select
                                                  class="h-7 min-w-[140px] rounded border px-2 text-xs"
                                                  data-tech-field="mapping-line-piece-id"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                >
                                                  <option value="">未绑定裁片</option>
                                                  ${pieceOptions
                                                    .map(
                                                      (piece) => `<option value="${piece.id}" ${line.pieceId === piece.id ? 'selected' : ''}>${escapeHtml(piece.name)}</option>`,
                                                    )
                                                    .join('')}
                                                </select>
                                              </td>
                                              <td class="px-2 py-1.5 text-right">
                                                <div class="flex items-center justify-end gap-1">
                                                  <input
                                                    class="h-7 w-20 rounded border px-2 text-right text-xs"
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    value="${escapeHtml(String(line.pieceCountPerUnit || 0))}"
                                                    data-tech-field="mapping-line-piece-count"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                  />
                                                  <input
                                                    class="h-7 w-12 rounded border px-1 text-center text-[11px]"
                                                    value="${escapeHtml(line.unit)}"
                                                    data-tech-field="mapping-line-unit"
                                                    data-mapping-id="${mapping.id}"
                                                    data-line-id="${line.id}"
                                                  />
                                                </div>
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <input
                                                  class="h-7 min-w-[220px] rounded border px-2 text-xs"
                                                  value="${escapeHtml(line.applicableSkuCodes.join(','))}"
                                                  placeholder="留空=全部SKU，或输入 SKU-001-A,SKU-001-B"
                                                  data-tech-field="mapping-line-skus"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                />
                                                ${
                                                  line.applicableSkuCodes.length > 0
                                                    ? `<div class="mt-1 flex flex-wrap gap-1">${line.applicableSkuCodes
                                                        .map((skuCode) => {
                                                          const label = skuLabelByCode.get(skuCode) || skuCode
                                                          return `<span class="inline-flex rounded border px-1.5 py-0.5 text-[10px]">${escapeHtml(label)}</span>`
                                                        })
                                                        .join('')}</div>`
                                                    : '<div class="mt-1 text-[10px] text-muted-foreground">全部 SKU</div>'
                                                }
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <select
                                                  class="h-7 rounded border px-2 text-xs"
                                                  data-tech-field="mapping-line-source-mode"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                >
                                                  <option value="AUTO" ${line.sourceMode === 'AUTO' ? 'selected' : ''}>系统生成</option>
                                                  <option value="MANUAL" ${line.sourceMode === 'MANUAL' ? 'selected' : ''}>人工维护</option>
                                                </select>
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <input
                                                  class="h-7 min-w-[160px] rounded border px-2 text-xs"
                                                  value="${escapeHtml(line.note || '')}"
                                                  placeholder="备注"
                                                  data-tech-field="mapping-line-note"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                />
                                              </td>
                                              <td class="px-2 py-1.5">
                                                <button
                                                  class="inline-flex h-7 items-center rounded border px-2 text-xs text-red-600 hover:bg-red-50"
                                                  data-tech-action="delete-mapping-line"
                                                  data-mapping-id="${mapping.id}"
                                                  data-line-id="${line.id}"
                                                >
                                                  删除
                                                </button>
                                              </td>
                                            </tr>
                                          `
                                          },
                                        )
                                        .join('')
                                }
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </article>
                    `
                  })
                  .join('')
          }
        </div>
      </section>
    </div>
  `
}

function renderDesignTab(): string {
  const techPack = state.techPack
  if (!techPack) return ''

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">花型设计</h3>
          <p class="mt-1 text-sm text-muted-foreground">花型图案与设计稿</p>
        </div>
        <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-design">
          <i data-lucide="upload" class="mr-2 h-4 w-4"></i>
          上传设计稿
        </button>
      </header>
      <div class="p-4">
        ${
          techPack.patternDesigns.length === 0
            ? '<div class="py-8 text-center text-muted-foreground">暂无数据</div>'
            : `
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                ${techPack.patternDesigns
                  .map(
                    (item) => `
                      <div class="rounded-lg border p-2">
                        <div class="mb-2 flex aspect-square items-center justify-center rounded bg-muted">
                          <i data-lucide="image" class="h-8 w-8 text-muted-foreground"></i>
                        </div>
                        <div class="flex items-center justify-between gap-1">
                          <p class="truncate text-sm font-medium" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>
                          <button class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-design" data-design-id="${item.id}">
                            <i data-lucide="trash-2" class="h-3 w-3"></i>
                          </button>
                        </div>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
        }
      </div>
    </section>
  `
}

function renderAttachmentsTab(): string {
  const techPack = state.techPack
  if (!techPack) return ''

  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 class="text-base font-semibold">附件</h3>
          <p class="mt-1 text-sm text-muted-foreground">其他相关文档和附件</p>
        </div>
        <button class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-add-attachment">
          <i data-lucide="upload" class="mr-2 h-4 w-4"></i>
          上传附件
        </button>
      </header>
      <div class="p-4">
        ${
          techPack.attachments.length === 0
            ? '<div class="py-8 text-center text-muted-foreground">暂无数据</div>'
            : `
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b bg-muted/30">
                    <th class="px-3 py-2 text-left">文件名</th>
                    <th class="px-3 py-2 text-left">类型</th>
                    <th class="px-3 py-2 text-left">大小</th>
                    <th class="px-3 py-2 text-left">上传时间</th>
                    <th class="px-3 py-2 text-left">上传人</th>
                    <th class="px-3 py-2 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${techPack.attachments
                    .map(
                      (item) => `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 font-medium">${escapeHtml(item.fileName)}</td>
                          <td class="px-3 py-2"><span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(item.fileType)}</span></td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.fileSize)}</td>
                          <td class="px-3 py-2 text-sm text-muted-foreground">${escapeHtml(item.uploadedAt)}</td>
                          <td class="px-3 py-2 text-sm">${escapeHtml(item.uploadedBy)}</td>
                          <td class="px-3 py-2">
                            <div class="flex items-center gap-1">
                              <button class="rounded px-2 py-1 text-xs hover:bg-muted" data-tech-action="download-attachment" data-attachment-id="${item.id}">下载</button>
                              <button class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-attachment" data-attachment-id="${item.id}">
                                <i data-lucide="trash-2" class="h-3 w-3"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                    .join('')}
                </tbody>
              </table>
            `
        }
      </div>
    </section>
  `
}

function renderCurrentTabContent(): string {
  if (state.activeTab === 'pattern') return renderPatternTab()
  if (state.activeTab === 'bom') return renderBomTab()
  if (state.activeTab === 'process') return renderProcessTab()
  if (state.activeTab === 'cost') return renderCostTab()
  if (state.activeTab === 'color-mapping') return renderColorMappingTab()
  if (state.activeTab === 'size') return renderSizeTab()
  if (state.activeTab === 'design') return renderDesignTab()
  return renderAttachmentsTab()
}

function renderPatternDialog(): string {
  if (!state.patternDialogOpen || !state.selectedPattern) return ''

  const pattern = getPatternBySelectionKey(state.selectedPattern)
  if (!pattern) return ''
  const linkedBom =
    pattern.linkedBomItemId.length > 0
      ? state.bomItems.find((item) => item.id === pattern.linkedBomItemId) ?? null
      : null
  const image = pattern.image ? `/placeholder.svg?height=96&width=96` : '/placeholder.svg?height=96&width=96'
  const pieceRows = pattern.pieceRows
  const pieceTotal =
    Number.isFinite(pattern.totalPieceCount) && pattern.totalPieceCount > 0
      ? pattern.totalPieceCount
      : pieceRows.reduce((sum, row) => sum + row.count, 0)

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-2xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">纸样详情</h3>
        </header>
        <div class="space-y-4 px-6 py-4 text-sm">
          <div class="flex items-center gap-4">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(pattern.name)}" class="h-24 w-24 rounded border object-cover" />
            <div>
              <h4 class="text-lg font-semibold">${escapeHtml(pattern.name)}</h4>
              <p class="text-sm text-muted-foreground">${escapeHtml(pattern.type)}</p>
            </div>
          </div>
          <div class="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-2">
            <div>
              <p class="text-xs text-muted-foreground">关联物料</p>
              <p class="mt-1">${escapeHtml(linkedBom ? `${linkedBom.materialCode} · ${linkedBom.materialName}` : '未关联')}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">规格（门幅 × 排料长度）</p>
              <p class="mt-1">${escapeHtml(formatPatternSpec(pattern.widthCm, pattern.markerLengthM))}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">裁片总片数</p>
              <p class="mt-1">${pieceTotal} 片</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground">纸样文件</p>
              <p class="mt-1 text-muted-foreground">${escapeHtml(pattern.file || '-')}</p>
            </div>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h5 class="text-sm font-medium">裁片明细</h5>
              <span class="text-xs text-muted-foreground">单位：片</span>
            </div>
            ${
              pieceRows.length === 0
                ? '<div class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">当前暂无裁片明细</div>'
                : `
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b bg-muted/20">
                        <th class="px-2 py-1 text-left">裁片名称</th>
                        <th class="px-2 py-1 text-right">片数</th>
                        <th class="px-2 py-1 text-left">适用 SKU</th>
                        <th class="px-2 py-1 text-left">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pieceRows
                        .map(
                          (row) => `
                            <tr class="border-b last:border-0">
                              <td class="px-2 py-1">${escapeHtml(row.name)}</td>
                              <td class="px-2 py-1 text-right">${row.count}</td>
                              <td class="px-2 py-1">
                                ${
                                  row.applicableSkuCodes.length === 0
                                    ? '<span class="text-muted-foreground">全部 SKU</span>'
                                    : `<div class="flex flex-wrap gap-1">${row.applicableSkuCodes
                                        .map(
                                          (skuCode) =>
                                            `<span class="inline-flex rounded border px-1 py-0.5 text-[10px]">${escapeHtml(skuCode)}</span>`,
                                        )
                                        .join('')}</div>`
                                }
                              </td>
                              <td class="px-2 py-1 text-muted-foreground">${escapeHtml(row.note || '-')}</td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `
            }
          </div>
          ${
            pattern.remark
              ? `<p class="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">备注：${escapeHtml(pattern.remark)}</p>`
              : ''
          }
        </div>
        <footer class="flex items-center justify-end border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-pattern-detail">关闭</button>
        </footer>
      </section>
    </div>
  `
}

function renderReleaseDialog(): string {
  if (!state.releaseDialogOpen || !state.techPack) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">发布技术包</h3>
          <p class="mt-1 text-sm text-muted-foreground">确定将技术包 ${escapeHtml(state.techPack.spuCode)} 发布为正式版本吗？发布后生产单可正常拆解。</p>
        </header>
        <footer class="flex items-center justify-end gap-2 px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-release">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="confirm-release">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderPatternFormDialog(): string {
  if (!state.addPatternDialogOpen) return ''
  const bomOptions = state.bomItems

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-3xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${state.editPatternItemId ? '编辑纸样' : '新增纸样'}</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label class="space-y-1">
              <span class="text-sm">纸样名称 <span class="text-red-500">*</span></span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-name" value="${escapeHtml(state.newPattern.name)}" placeholder="例如 前片" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">纸样类型</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-type">
                ${['主体片', '结构片', '装饰片', '其他']
                  .map((option) => `<option value="${option}" ${state.newPattern.type === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">关联物料（BOM）</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-linked-bom-item">
                <option value="">请选择关联物料</option>
                ${bomOptions
                  .map(
                    (item) =>
                      `<option value="${item.id}" ${state.newPattern.linkedBomItemId === item.id ? 'selected' : ''}>${escapeHtml(`${item.materialCode} · ${item.materialName}`)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">门幅（cm）</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-width-cm" value="${escapeHtml(String(state.newPattern.widthCm || ''))}" placeholder="例如 142" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">排料长度（m）</span>
              <input type="number" step="0.01" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-marker-length-m" value="${escapeHtml(String(state.newPattern.markerLengthM || ''))}" placeholder="例如 2.62" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">裁片总片数（片）</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-total-piece-count" value="${escapeHtml(String(state.newPattern.totalPieceCount || ''))}" placeholder="例如 6" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-sm">纸样文件</span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-file" value="${escapeHtml(state.newPattern.file)}" placeholder="例如 front.dxf" />
            </label>
            <label class="space-y-1 md:col-span-2">
              <span class="text-sm">备注</span>
              <textarea rows="2" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-remark" placeholder="备注信息">${escapeHtml(state.newPattern.remark)}</textarea>
            </label>
          </div>

          <section class="space-y-2 rounded-md border p-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-medium">裁片明细</h4>
              <button type="button" class="inline-flex items-center rounded border px-2 py-1 text-xs hover:bg-muted" data-tech-action="add-new-pattern-piece-row">
                <i data-lucide="plus" class="mr-1 h-3 w-3"></i>
                新增裁片
              </button>
            </div>
            ${
              state.newPattern.pieceRows.length === 0
                ? '<div class="rounded border border-dashed px-3 py-3 text-xs text-muted-foreground">暂无裁片明细，可点击“新增裁片”补充</div>'
                : `
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b bg-muted/20">
                        <th class="px-2 py-1 text-left">裁片名称</th>
                        <th class="px-2 py-1 text-right">片数</th>
                        <th class="px-2 py-1 text-left">备注</th>
                        <th class="px-2 py-1 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${state.newPattern.pieceRows
                        .map(
                          (row) => `
                            <tr class="border-b last:border-0">
                              <td class="px-2 py-1">
                                <input class="h-7 w-full rounded border px-2 text-xs" data-tech-field="new-pattern-piece-name" data-piece-id="${row.id}" value="${escapeHtml(row.name)}" placeholder="例如 前片" />
                              </td>
                              <td class="px-2 py-1">
                                <input type="number" class="h-7 w-20 rounded border px-2 text-right text-xs" data-tech-field="new-pattern-piece-count" data-piece-id="${row.id}" value="${escapeHtml(String(row.count || 0))}" />
                              </td>
                              <td class="px-2 py-1">
                                <input class="h-7 w-full rounded border px-2 text-xs" data-tech-field="new-pattern-piece-note" data-piece-id="${row.id}" value="${escapeHtml(row.note)}" placeholder="备注" />
                              </td>
                              <td class="px-2 py-1 text-right">
                                <button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-new-pattern-piece-row" data-piece-id="${row.id}">
                                  <i data-lucide="trash-2" class="h-3 w-3"></i>
                                </button>
                              </td>
                            </tr>
                          `,
                        )
                        .join('')}
                    </tbody>
                  </table>
                `
            }
          </section>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-pattern">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newPattern.name.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-pattern">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderBomFormDialog(): string {
  if (!state.addBomDialogOpen) return ''
  const skuOptions = getSkuOptionsForCurrentSpu()
  const colorOptions = dedupeStrings(skuOptions.map((item) => item.color))
  const applyAllSku = state.newBomItem.applicableSkuCodes.length === 0

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-2xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${state.editBomItemId ? '编辑物料' : '添加物料'}</h3>
        </header>
        <div class="grid grid-cols-1 gap-6 px-6 py-4 md:grid-cols-2">
          <div class="space-y-4">
            <label class="space-y-1">
              <span class="text-sm">物料类型</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-type">
                ${['面料', '辅料', '包装材料', '其他']
                  .map((option) => `<option value="${option}" ${state.newBomItem.type === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">颜色</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-color-label">
                <option value="">未指定颜色</option>
                <option value="全部SKU（当前未区分颜色）" ${state.newBomItem.colorLabel === '全部SKU（当前未区分颜色）' ? 'selected' : ''}>全部SKU（当前未区分颜色）</option>
                ${colorOptions
                  .map(
                    (option) =>
                      `<option value="${escapeHtml(option)}" ${state.newBomItem.colorLabel === option ? 'selected' : ''}>${escapeHtml(option)}</option>`,
                  )
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">物料编码</span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-material-code" value="${escapeHtml(state.newBomItem.materialCode)}" placeholder="例如 FAB-001" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">规格</span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-spec" value="${escapeHtml(state.newBomItem.spec)}" placeholder="例如 180g/m²" />
            </label>
            <div class="space-y-1">
              <span class="text-sm">适用 SKU</span>
              <div class="space-y-2 rounded-md border p-2 text-xs">
                <label class="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    data-tech-field="new-bom-apply-all-sku"
                    ${applyAllSku ? 'checked' : ''}
                  />
                  <span>全部 SKU</span>
                </label>
                ${
                  skuOptions.length === 0
                    ? '<p class="text-muted-foreground">当前 SPU 暂无 SKU 数据，默认按全部 SKU 处理</p>'
                    : `
                      <div class="grid grid-cols-1 gap-1">
                        ${skuOptions
                          .map(
                            (sku) => `
                              <label class="inline-flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  data-tech-field="new-bom-sku"
                                  data-sku-code="${sku.skuCode}"
                                  ${state.newBomItem.applicableSkuCodes.includes(sku.skuCode) ? 'checked' : ''}
                                  ${applyAllSku ? 'disabled' : ''}
                                />
                                <span>${escapeHtml(`${sku.color}（${sku.skuCode}${sku.size ? ` / ${sku.size}` : ''}）`)}</span>
                              </label>
                            `,
                          )
                          .join('')}
                      </div>
                    `
                }
              </div>
            </div>
            <div class="space-y-1">
              <span class="text-sm">使用工序</span>
              <div class="grid grid-cols-2 gap-2 rounded-md border p-2 text-xs">
                ${bomUsageProcessOptions
                  .map(
                    (option) => `
                      <label class="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          data-tech-field="new-bom-usage-process"
                          data-process-code="${option.code}"
                          ${state.newBomItem.usageProcessCodes.includes(option.code) ? 'checked' : ''}
                        />
                        <span>${escapeHtml(option.label)}</span>
                      </label>
                    `,
                  )
                  .join('')}
              </div>
            </div>
            <label class="space-y-1">
              <span class="text-sm">单位用量</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-usage" value="${escapeHtml(state.newBomItem.usage)}" placeholder="0" />
            </label>
          </div>

          <div class="space-y-4">
            <label class="space-y-1">
              <span class="text-sm">物料名称 <span class="text-red-500">*</span></span>
              <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-material-name" value="${escapeHtml(state.newBomItem.materialName)}" placeholder="例如 纯棉针织布" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">损耗率(%)</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-loss-rate" value="${escapeHtml(state.newBomItem.lossRate)}" placeholder="0" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">印花需求</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-print-requirement">
                ${printOptions
                  .map((option) => `<option value="${option}" ${state.newBomItem.printRequirement === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
            <label class="space-y-1">
              <span class="text-sm">染色需求</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-bom-dye-requirement">
                ${dyeOptions
                  .map((option) => `<option value="${option}" ${state.newBomItem.dyeRequirement === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
          </div>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-bom">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newBomItem.materialName.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-bom">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderAddTechniqueDialog(): string {
  if (!state.addTechniqueDialogOpen) return ''

  const currentStageProcesses = dictProcessOptions[state.newTechnique.stage] ?? []
  const currentProcessEntry = currentStageProcesses.find((item) => item.process === state.newTechnique.process)
  const techniquesForProcess = currentProcessEntry?.techniques ?? []

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">新增工序工艺</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">阶段 <span class="text-red-500">*</span></span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-stage">
              ${stageOptions
                .map((option) => `<option value="${option}" ${state.newTechnique.stage === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-sm">工序 <span class="text-red-500">*</span></span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-process">
              <option value="">从字典中选择工序</option>
              ${currentStageProcesses
                .map((item) => `<option value="${item.process}" ${state.newTechnique.process === item.process ? 'selected' : ''}>${item.process}</option>`)
                .join('')}
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-sm">工艺 <span class="text-red-500">*</span></span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-technique" ${state.newTechnique.process ? '' : 'disabled'}>
              <option value="">${state.newTechnique.process ? '从字典中选择工艺' : '请先选择工序'}</option>
              ${techniquesForProcess
                .map((item) => `<option value="${item.name}" ${state.newTechnique.technique === item.name ? 'selected' : ''}>${item.name}</option>`)
                .join('')}
            </select>
          </label>

          ${
            state.newTechnique.technique
              ? '<p class="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">来源：工序工艺字典（字典新增）。标准工时、难度均可在下方调整为该商品实际值。</p>'
              : ''
          }

          <div class="grid grid-cols-2 gap-4">
            <label class="space-y-1">
              <span class="text-sm">标准工时</span>
              <input type="number" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-standard-time" value="${escapeHtml(state.newTechnique.standardTime)}" placeholder="0" />
            </label>
            <label class="space-y-1">
              <span class="text-sm">工时单位</span>
              <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-time-unit">
                ${timeUnitOptions
                  .map((option) => `<option value="${option}" ${state.newTechnique.timeUnit === option ? 'selected' : ''}>${option}</option>`)
                  .join('')}
              </select>
            </label>
          </div>

          <label class="space-y-1">
            <span class="text-sm">难度</span>
            <select class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-difficulty">
              ${difficultyOptions
                .map((option) => `<option value="${option}" ${state.newTechnique.difficulty === option ? 'selected' : ''}>${option}</option>`)
                .join('')}
            </select>
          </label>

          <div class="space-y-2">
            <label class="inline-flex items-center gap-2">
              <input type="checkbox" data-tech-field="new-technique-enable-qc" ${state.newTechnique.enableQualityCheck ? 'checked' : ''} />
              <span class="text-sm">安排质检</span>
            </label>
            ${
              state.newTechnique.enableQualityCheck
                ? `
                  <div class="rounded-md border">
                    ${state.newTechnique.qualityChecks
                      .map(
                        (qc, index) => `
                          <div class="flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0">
                            <span class="w-4 shrink-0 text-xs text-muted-foreground">${index + 1}</span>
                            <input class="h-7 flex-1 rounded border px-2 text-xs" data-tech-field="new-qc-name" data-qc-id="${qc.id}" value="${escapeHtml(qc.name)}" placeholder="检查项名称" />
                            <button class="inline-flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50" data-tech-action="delete-new-quality-check" data-qc-id="${qc.id}">
                              <i data-lucide="trash-2" class="h-3 w-3"></i>
                            </button>
                          </div>
                        `,
                      )
                      .join('')}
                    <div class="px-3 py-1.5">
                      <button class="inline-flex items-center rounded px-2 py-1 text-xs hover:bg-muted" data-tech-action="add-new-quality-check">
                        <i data-lucide="plus" class="mr-1 h-3 w-3"></i>
                        新增检查项
                      </button>
                    </div>
                  </div>
                `
                : ''
            }
          </div>

          <label class="space-y-1">
            <span class="text-sm">备注</span>
            <textarea rows="2" class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-technique-remark" placeholder="备注信息">${escapeHtml(state.newTechnique.remark)}</textarea>
          </label>
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-technique">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newTechnique.process && state.newTechnique.technique ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-technique">确认新增</button>
        </footer>
      </section>
    </div>
  `
}

function renderAddSizeDialog(): string {
  if (!state.addSizeDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-lg rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">添加部位</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">部位 <span class="text-red-500">*</span></span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-size-part" value="${escapeHtml(state.newSizeRow.part)}" placeholder="例如 胸围" />
          </label>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
            <label class="space-y-1"><span class="text-xs text-muted-foreground">S</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-s" value="${escapeHtml(state.newSizeRow.S)}" /></label>
            <label class="space-y-1"><span class="text-xs text-muted-foreground">M</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-m" value="${escapeHtml(state.newSizeRow.M)}" /></label>
            <label class="space-y-1"><span class="text-xs text-muted-foreground">L</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-l" value="${escapeHtml(state.newSizeRow.L)}" /></label>
            <label class="space-y-1"><span class="text-xs text-muted-foreground">XL</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-xl" value="${escapeHtml(state.newSizeRow.XL)}" /></label>
            <label class="space-y-1"><span class="text-xs text-muted-foreground">公差(±)</span><input type="number" class="w-full rounded-md border px-2 py-2 text-sm" data-tech-field="new-size-tolerance" value="${escapeHtml(state.newSizeRow.tolerance)}" /></label>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-size">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newSizeRow.part.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-size">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderAddDesignDialog(): string {
  if (!state.addDesignDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">上传设计稿</h3>
        </header>
        <div class="px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">设计稿名称 <span class="text-red-500">*</span></span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-design-name" value="${escapeHtml(state.newDesignName)}" placeholder="例如 胸前Logo" />
          </label>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-design">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newDesignName.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-design">确认</button>
        </footer>
      </section>
    </div>
  `
}

function renderAddAttachmentDialog(): string {
  if (!state.addAttachmentDialogOpen) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">上传附件</h3>
        </header>
        <div class="space-y-4 px-6 py-4">
          <label class="space-y-1">
            <span class="text-sm">文件名 <span class="text-red-500">*</span></span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-attachment-file-name" value="${escapeHtml(state.newAttachment.fileName)}" placeholder="例如 工艺说明书.pdf" />
          </label>
          <label class="space-y-1">
            <span class="text-sm">类型</span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-attachment-file-type" value="${escapeHtml(state.newAttachment.fileType)}" placeholder="PDF" />
          </label>
          <label class="space-y-1">
            <span class="text-sm">大小</span>
            <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-attachment-file-size" value="${escapeHtml(state.newAttachment.fileSize)}" placeholder="1.0MB" />
          </label>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-add-attachment">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            state.newAttachment.fileName.trim() ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="save-attachment">确认</button>
        </footer>
      </section>
    </div>
  `
}

export function renderTechPackPage(rawSpuCode: string): string {
  ensureTechPackPageState(rawSpuCode)

  if (state.loading) {
    return '<div class="flex h-64 items-center justify-center text-muted-foreground">加载中...</div>'
  }

  if (!state.techPack || !state.currentSpuCode) {
    return '<div class="flex h-64 items-center justify-center text-muted-foreground">技术包不存在</div>'
  }

  const checklist = getChecklist()
  const hasIncomplete = checklist.some((item) => item.required && !item.done)
  const canRelease = !hasIncomplete && state.techPack.status !== 'RELEASED'

  return `
    <div class="space-y-4">
      <header class="flex items-start justify-between">
        <div>
          <div class="mb-1 flex items-center gap-2">
            <button class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="tech-back" aria-label="返回">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>
            </button>
            <h1 class="text-xl font-semibold">技术包 - ${escapeHtml(state.currentSpuCode)}</h1>
            ${renderStatusBadge(state.techPack.status)}
            <span class="text-sm text-muted-foreground">(${escapeHtml(state.techPack.versionLabel)})</span>
          </div>
          <p class="ml-10 text-sm text-muted-foreground">${escapeHtml(state.techPack.spuName)}</p>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span class="mr-1 text-sm font-medium text-muted-foreground">关键项检查:</span>
            ${renderChecklist()}
          </div>
          <button class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
            canRelease ? '' : 'pointer-events-none opacity-50'
          }" data-tech-action="open-release" title="${hasIncomplete ? '关键项未完成，暂不可发布' : ''}">
            <i data-lucide="check" class="mr-2 h-4 w-4"></i>
            发布
          </button>
        </div>
      </header>

      ${renderTabHeader()}
      ${renderCurrentTabContent()}

      ${renderPatternDialog()}
      ${renderReleaseDialog()}
      ${renderPatternFormDialog()}
      ${renderBomFormDialog()}
      ${renderAddTechniqueDialog()}
      ${renderAddSizeDialog()}
      ${renderAddDesignDialog()}
      ${renderAddAttachmentDialog()}
    </div>
  `
}

function getTechniqueById(techId: string): TechniqueItem | null {
  return state.techniques.find((item) => item.id === techId) ?? null
}

function updateTechnique(techId: string, updater: (item: TechniqueItem) => TechniqueItem): void {
  state.techniques = state.techniques.map((item) => (item.id === techId ? updater(item) : item))
  syncProcessCostRows()
  syncTechPackToStore()
}

function updateQualityCheck(
  techId: string,
  qcId: string,
  updater: (item: QualityCheckItem) => QualityCheckItem,
): void {
  updateTechnique(techId, (item) => ({
    ...item,
    qualityChecks: item.qualityChecks.map((qc) => (qc.id === qcId ? updater(qc) : qc)),
  }))
}

function handleTechPackField(
  node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): boolean {
  const field = node.dataset.techField
  if (!field) return false

  const value = node.value
  const checked = node instanceof HTMLInputElement ? node.checked : false

  if (field === 'new-pattern-name') {
    state.newPattern.name = value
    return true
  }
  if (field === 'new-pattern-type') {
    state.newPattern.type = value
    return true
  }
  if (field === 'new-pattern-image') {
    state.newPattern.image = value
    return true
  }
  if (field === 'new-pattern-file') {
    state.newPattern.file = value
    return true
  }
  if (field === 'new-pattern-remark') {
    state.newPattern.remark = value
    return true
  }
  if (field === 'new-pattern-linked-bom-item') {
    state.newPattern.linkedBomItemId = value
    return true
  }
  if (field === 'new-pattern-width-cm') {
    state.newPattern.widthCm = Number.parseFloat(value) || 0
    return true
  }
  if (field === 'new-pattern-marker-length-m') {
    state.newPattern.markerLengthM = Number.parseFloat(value) || 0
    return true
  }
  if (field === 'new-pattern-total-piece-count') {
    state.newPattern.totalPieceCount = Number.parseInt(value, 10) || 0
    return true
  }
  if (field === 'new-pattern-piece-name') {
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) =>
      row.id === pieceId ? { ...row, name: value } : row,
    )
    return true
  }
  if (field === 'new-pattern-piece-count') {
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) =>
      row.id === pieceId ? { ...row, count: Number.parseInt(value, 10) || 0 } : row,
    )
    return true
  }
  if (field === 'new-pattern-piece-note') {
    const pieceId = node.dataset.pieceId
    if (!pieceId) return true
    state.newPattern.pieceRows = state.newPattern.pieceRows.map((row) =>
      row.id === pieceId ? { ...row, note: value } : row,
    )
    return true
  }

  if (field === 'new-bom-type') {
    state.newBomItem.type = value
    return true
  }
  if (field === 'new-bom-color-label') {
    state.newBomItem.colorLabel = value
    return true
  }
  if (field === 'new-bom-material-code') {
    state.newBomItem.materialCode = value
    return true
  }
  if (field === 'new-bom-material-name') {
    state.newBomItem.materialName = value
    return true
  }
  if (field === 'new-bom-spec') {
    state.newBomItem.spec = value
    return true
  }
  if (field === 'new-bom-usage') {
    state.newBomItem.usage = value
    return true
  }
  if (field === 'new-bom-loss-rate') {
    state.newBomItem.lossRate = value
    return true
  }
  if (field === 'new-bom-print-requirement') {
    state.newBomItem.printRequirement = value
    return true
  }
  if (field === 'new-bom-dye-requirement') {
    state.newBomItem.dyeRequirement = value
    return true
  }
  if (field === 'new-bom-apply-all-sku') {
    if (checked) {
      state.newBomItem.applicableSkuCodes = []
      state.newBomItem.colorLabel = '全部SKU（当前未区分颜色）'
    } else if (state.newBomItem.applicableSkuCodes.length === 0) {
      const skuOptions = getSkuOptionsForCurrentSpu()
      if (skuOptions.length > 0) {
        state.newBomItem.applicableSkuCodes = [skuOptions[0].skuCode]
        if (!state.newBomItem.colorLabel || state.newBomItem.colorLabel.startsWith('全部SKU')) {
          state.newBomItem.colorLabel = skuOptions[0].color
        }
      }
    }
    return true
  }
  if (field === 'new-bom-sku') {
    const skuCode = node.dataset.skuCode
    if (!skuCode) return true
    if (checked) {
      const current = new Set(state.newBomItem.applicableSkuCodes)
      current.add(skuCode)
      state.newBomItem.applicableSkuCodes = Array.from(current)
    } else {
      state.newBomItem.applicableSkuCodes = state.newBomItem.applicableSkuCodes.filter(
        (code) => code !== skuCode,
      )
    }
    return true
  }
  if (field === 'new-bom-usage-process') {
    const processCode = node.dataset.processCode
    if (!processCode) return true
    if (checked) {
      state.newBomItem.usageProcessCodes = dedupeStrings([
        ...state.newBomItem.usageProcessCodes,
        processCode,
      ])
    } else {
      state.newBomItem.usageProcessCodes = state.newBomItem.usageProcessCodes.filter(
        (code) => code !== processCode,
      )
    }
    return true
  }

  if (field === 'new-technique-stage') {
    state.newTechnique = {
      ...state.newTechnique,
      stage: value,
      process: '',
      technique: '',
      standardTime: '',
      timeUnit: '分钟/件',
      difficulty: '中等',
      enableQualityCheck: false,
      qualityChecks: [],
    }
    return true
  }
  if (field === 'new-technique-process') {
    state.newTechnique = {
      ...state.newTechnique,
      process: value,
      technique: '',
      standardTime: '',
      timeUnit: '分钟/件',
      difficulty: '中等',
      enableQualityCheck: false,
      qualityChecks: [],
    }
    return true
  }
  if (field === 'new-technique-technique') {
    const dictionaryEntry = getTechniqueDictionaryEntry(
      state.newTechnique.stage,
      state.newTechnique.process,
      value,
    )
    state.newTechnique = {
      ...state.newTechnique,
      technique: value,
      standardTime: dictionaryEntry ? String(dictionaryEntry.stdTime) : state.newTechnique.standardTime,
      timeUnit: dictionaryEntry ? dictionaryEntry.timeUnit : state.newTechnique.timeUnit,
      difficulty: dictionaryEntry ? dictionaryEntry.difficulty : state.newTechnique.difficulty,
      qualityChecks: dictionaryEntry
        ? dictionaryEntry.checks.map((item, index) => ({
            id: `qc-new-${index}`,
            name: item,
            required: true,
            standard: '',
          }))
        : state.newTechnique.qualityChecks,
      enableQualityCheck: dictionaryEntry ? dictionaryEntry.checks.length > 0 : state.newTechnique.enableQualityCheck,
    }
    return true
  }
  if (field === 'new-technique-standard-time') {
    state.newTechnique.standardTime = value
    return true
  }
  if (field === 'new-technique-time-unit') {
    state.newTechnique.timeUnit = value
    return true
  }
  if (field === 'new-technique-difficulty') {
    state.newTechnique.difficulty = value as TechniqueItem['difficulty']
    return true
  }
  if (field === 'new-technique-remark') {
    state.newTechnique.remark = value
    return true
  }
  if (field === 'new-technique-enable-qc') {
    state.newTechnique.enableQualityCheck = checked
    if (!checked) {
      state.newTechnique.qualityChecks = []
    }
    return true
  }
  if (field === 'new-qc-name') {
    const qcId = node.dataset.qcId
    if (!qcId) return true
    state.newTechnique.qualityChecks = state.newTechnique.qualityChecks.map((item) =>
      item.id === qcId ? { ...item, name: value } : item,
    )
    return true
  }

  if (field === 'bom-print') {
    const bomId = node.dataset.bomId
    if (!bomId) return true
    state.bomItems = state.bomItems.map((item) =>
      item.id === bomId ? { ...item, printRequirement: value } : item,
    )
    syncTechPackToStore()
    return true
  }
  if (field === 'bom-dye') {
    const bomId = node.dataset.bomId
    if (!bomId) return true
    state.bomItems = state.bomItems.map((item) =>
      item.id === bomId ? { ...item, dyeRequirement: value } : item,
    )
    syncTechPackToStore()
    return true
  }

  if (field === 'tech-standard-time') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({
      ...item,
      standardTime: Number.parseFloat(value) || 0,
    }))
    return true
  }
  if (field === 'tech-time-unit') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({ ...item, timeUnit: value }))
    return true
  }
  if (field === 'tech-difficulty') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({
      ...item,
      difficulty: value as TechniqueItem['difficulty'],
    }))
    return true
  }
  if (field === 'tech-enable-qc') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({
      ...item,
      enableQualityCheck: checked,
      qualityChecks: checked ? item.qualityChecks : [],
    }))
    return true
  }
  if (field === 'tech-remark') {
    const techId = node.dataset.techId
    if (!techId) return true
    updateTechnique(techId, (item) => ({ ...item, remark: value }))
    return true
  }

  if (field === 'qc-name') {
    const techId = node.dataset.techId
    const qcId = node.dataset.qcId
    if (!techId || !qcId) return true
    updateQualityCheck(techId, qcId, (item) => ({ ...item, name: value }))
    return true
  }
  if (field === 'qc-standard') {
    const techId = node.dataset.techId
    const qcId = node.dataset.qcId
    if (!techId || !qcId) return true
    updateQualityCheck(techId, qcId, (item) => ({ ...item, standard: value }))
    return true
  }
  if (field === 'qc-required') {
    const techId = node.dataset.techId
    const qcId = node.dataset.qcId
    if (!techId || !qcId) return true
    updateQualityCheck(techId, qcId, (item) => ({ ...item, required: checked }))
    return true
  }

  if (field === 'material-price') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.materialCostRows = state.materialCostRows.map((row) =>
      row.id === rowId ? { ...row, price: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'material-currency') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.materialCostRows = state.materialCostRows.map((row) =>
      row.id === rowId ? { ...row, currency: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'material-unit') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.materialCostRows = state.materialCostRows.map((row) =>
      row.id === rowId ? { ...row, unit: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (field === 'process-price') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.processCostRows = state.processCostRows.map((row) =>
      row.id === rowId ? { ...row, price: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'process-currency') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.processCostRows = state.processCostRows.map((row) =>
      row.id === rowId ? { ...row, currency: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'process-unit') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.processCostRows = state.processCostRows.map((row) =>
      row.id === rowId ? { ...row, unit: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (field === 'custom-cost-name') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, name: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'custom-cost-price') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, price: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'custom-cost-currency') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, currency: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'custom-cost-unit') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, unit: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }
  if (field === 'custom-cost-remark') {
    const rowId = node.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.map((row) =>
      row.id === rowId ? { ...row, remark: value } : row,
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (field === 'mapping-remark') {
    const mappingId = node.dataset.mappingId
    if (!mappingId) return true
    updateColorMapping(mappingId, (mapping) => ({
      ...mapping,
      remark: value,
      ...(mapping.generatedMode === 'AUTO' ? { generatedMode: 'MANUAL', status: 'MANUAL_ADJUSTED' } : {}),
    }))
    syncTechPackToStore({ touch: false })
    return true
  }

  if (
    field === 'mapping-line-bom-item' ||
    field === 'mapping-line-material-name' ||
    field === 'mapping-line-material-code' ||
    field === 'mapping-line-pattern-id' ||
    field === 'mapping-line-piece-id' ||
    field === 'mapping-line-piece-count' ||
    field === 'mapping-line-unit' ||
    field === 'mapping-line-skus' ||
    field === 'mapping-line-source-mode' ||
    field === 'mapping-line-note'
  ) {
    const mappingId = node.dataset.mappingId
    const lineId = node.dataset.lineId
    if (!mappingId || !lineId) return true

    if (field === 'mapping-line-bom-item') {
      const selectedBom = state.bomItems.find((item) => item.id === value)
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        bomItemId: value,
        materialCode: selectedBom?.materialCode || line.materialCode,
        materialName: selectedBom?.materialName || line.materialName,
        materialType: selectedBom?.type || line.materialType,
        applicableSkuCodes:
          selectedBom && selectedBom.applicableSkuCodes.length > 0
            ? [...selectedBom.applicableSkuCodes]
            : line.applicableSkuCodes,
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-material-name') {
      updateColorMappingLine(mappingId, lineId, (line) => ({ ...line, materialName: value }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-material-code') {
      updateColorMappingLine(mappingId, lineId, (line) => ({ ...line, materialCode: value }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-pattern-id') {
      const selectedPattern = getPatternById(value)
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        patternId: value,
        patternName: selectedPattern?.name || '',
        pieceId: '',
        pieceName: '',
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-piece-id') {
      let patternId = ''
      const currentMapping = state.colorMaterialMappings.find((item) => item.id === mappingId)
      const currentLine = currentMapping?.lines.find((line) => line.id === lineId)
      if (currentLine) patternId = currentLine.patternId
      const piece = getPatternPieceById(patternId, value)
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        pieceId: value,
        pieceName: piece?.name || '',
        pieceCountPerUnit: piece?.count ?? line.pieceCountPerUnit,
        applicableSkuCodes:
          piece && piece.applicableSkuCodes.length > 0
            ? [...piece.applicableSkuCodes]
            : line.applicableSkuCodes,
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-piece-count') {
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        pieceCountPerUnit: Number.parseFloat(value) || 0,
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-unit') {
      updateColorMappingLine(mappingId, lineId, (line) => ({ ...line, unit: value }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-skus') {
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        applicableSkuCodes: dedupeStrings(
          value
            .split(',')
            .map((item) => item.trim())
            .filter((item) => item.length > 0),
        ),
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-source-mode') {
      updateColorMappingLine(mappingId, lineId, (line) => ({
        ...line,
        sourceMode: value === 'MANUAL' ? 'MANUAL' : 'AUTO',
      }))
      syncTechPackToStore({ touch: false })
      return true
    }

    if (field === 'mapping-line-note') {
      updateColorMappingLine(mappingId, lineId, (line) => ({ ...line, note: value }))
      syncTechPackToStore({ touch: false })
      return true
    }
  }

  if (field === 'new-size-part') {
    state.newSizeRow.part = value
    return true
  }
  if (field === 'new-size-s') {
    state.newSizeRow.S = value
    return true
  }
  if (field === 'new-size-m') {
    state.newSizeRow.M = value
    return true
  }
  if (field === 'new-size-l') {
    state.newSizeRow.L = value
    return true
  }
  if (field === 'new-size-xl') {
    state.newSizeRow.XL = value
    return true
  }
  if (field === 'new-size-tolerance') {
    state.newSizeRow.tolerance = value
    return true
  }

  if (field === 'new-design-name') {
    state.newDesignName = value
    return true
  }

  if (field === 'new-attachment-file-name') {
    state.newAttachment.fileName = value
    return true
  }
  if (field === 'new-attachment-file-type') {
    state.newAttachment.fileType = value
    return true
  }
  if (field === 'new-attachment-file-size') {
    state.newAttachment.fileSize = value
    return true
  }

  return false
}

function performRelease(): void {
  if (!state.techPack) return

  const currentVersionNum =
    state.techPack.versionLabel === 'beta'
      ? 0
      : Number.parseInt(state.techPack.versionLabel.replace('v', '').split('.')[0] || '0', 10) || 0

  state.techPack = {
    ...state.techPack,
    status: 'RELEASED',
    versionLabel: `v${currentVersionNum + 1}.0`,
    lastUpdatedAt: toTimestamp(),
    lastUpdatedBy: currentUser.name,
  }

  syncTechPackToStore({ touch: false })
  state.releaseDialogOpen = false
}

export function handleTechPackEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-tech-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    return handleTechPackField(fieldNode)
  }

  const actionNode = target.closest<HTMLElement>('[data-tech-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.techAction
  if (!action) return false

  if (action === 'switch-tab') {
    const tab = actionNode.dataset.tab as TechPackTab | undefined
    if (!tab) return true
    state.activeTab = tab
    return true
  }

  if (action === 'tech-back') {
    if (state.currentSpuCode) {
      appStore.closeTab(`tech-pack-${state.currentSpuCode}`)
      return true
    }

    appStore.navigate('/fcs/production/demand-inbox')
    return true
  }

  if (action === 'open-release') {
    state.releaseDialogOpen = true
    return true
  }
  if (action === 'close-release') {
    state.releaseDialogOpen = false
    return true
  }
  if (action === 'confirm-release') {
    performRelease()
    return true
  }

  if (action === 'open-add-pattern') {
    resetPatternForm()
    state.addPatternDialogOpen = true
    return true
  }
  if (action === 'close-add-pattern') {
    state.addPatternDialogOpen = false
    return true
  }
  if (action === 'edit-pattern') {
    const patternId = actionNode.dataset.patternId
    if (!patternId) return true

    const pattern = state.patternItems.find((item) => item.id === patternId)
    if (!pattern) return true

    state.editPatternItemId = pattern.id
    state.newPattern = {
      name: pattern.name,
      type: pattern.type,
      image: pattern.image,
      file: pattern.file,
      remark: pattern.remark,
      linkedBomItemId: pattern.linkedBomItemId,
      widthCm: pattern.widthCm,
      markerLengthM: pattern.markerLengthM,
      totalPieceCount: pattern.totalPieceCount,
      pieceRows: pattern.pieceRows.map((row) => ({ ...row })),
    }
    state.addPatternDialogOpen = true
    return true
  }
  if (action === 'delete-pattern') {
    const patternId = actionNode.dataset.patternId
    if (!patternId) return true

    state.patternItems = state.patternItems.filter((item) => item.id !== patternId)
    syncTechPackToStore()
    return true
  }
  if (action === 'save-pattern') {
    if (!state.newPattern.name.trim()) return true
    const nowId = state.editPatternItemId || `PAT-${Date.now()}`
    const normalizedPieceRows = normalizePatternPieceRows(
      state.newPattern.pieceRows.map((row) => ({ ...row })),
      nowId,
    )

    if (state.editPatternItemId) {
      state.patternItems = state.patternItems.map((item) =>
        item.id === state.editPatternItemId
          ? {
              ...item,
              ...state.newPattern,
              pieceRows: normalizedPieceRows,
            }
          : item,
      )
    } else {
      state.patternItems = [
        ...state.patternItems,
        {
          id: nowId,
          ...state.newPattern,
          pieceRows: normalizedPieceRows,
        },
      ]
    }

    syncTechPackToStore()
    state.addPatternDialogOpen = false
    return true
  }
  if (action === 'add-new-pattern-piece-row') {
    state.newPattern.pieceRows = [
      ...state.newPattern.pieceRows,
      {
        id: `piece-${Date.now()}`,
        name: '',
        count: 1,
        note: '',
        applicableSkuCodes: [],
      },
    ]
    return true
  }
  if (action === 'delete-new-pattern-piece-row') {
    const pieceId = actionNode.dataset.pieceId
    if (!pieceId) return true
    state.newPattern.pieceRows = state.newPattern.pieceRows.filter((row) => row.id !== pieceId)
    return true
  }

  if (action === 'open-pattern-detail') {
    const patternId = actionNode.dataset.patternId
    const patternName = actionNode.dataset.patternName
    if (!patternId && !patternName) return true
    state.selectedPattern = patternId || patternName || null
    state.patternDialogOpen = true
    return true
  }
  if (action === 'close-pattern-detail') {
    state.patternDialogOpen = false
    state.selectedPattern = null
    return true
  }

  if (action === 'open-add-bom') {
    resetBomForm()
    state.addBomDialogOpen = true
    return true
  }
  if (action === 'edit-bom') {
    const bomId = actionNode.dataset.bomId
    if (!bomId) return true
    const bom = state.bomItems.find((item) => item.id === bomId)
    if (!bom) return true
    state.editBomItemId = bom.id
    state.newBomItem = {
      type: bom.type,
      colorLabel: bom.colorLabel,
      materialCode: bom.materialCode,
      materialName: bom.materialName,
      spec: bom.spec,
      patternPieces: [...bom.patternPieces],
      linkedPatternIds: [...bom.linkedPatternIds],
      applicableSkuCodes: [...bom.applicableSkuCodes],
      usageProcessCodes: [...bom.usageProcessCodes],
      usage: String(bom.usage),
      lossRate: String(bom.lossRate),
      printRequirement: bom.printRequirement,
      dyeRequirement: bom.dyeRequirement,
    }
    state.addBomDialogOpen = true
    return true
  }
  if (action === 'close-add-bom') {
    state.addBomDialogOpen = false
    return true
  }
  if (action === 'save-bom') {
    if (!state.newBomItem.materialName.trim()) return true
    const editingBom = state.editBomItemId
      ? state.bomItems.find((item) => item.id === state.editBomItemId) ?? null
      : null
    const linkedPatternIds = editingBom ? [...editingBom.linkedPatternIds] : []
    const patternPieces = editingBom ? [...editingBom.patternPieces] : []
    const nextBom: BomItemRow = {
      id: state.editBomItemId || `bom-${Date.now()}`,
      type: state.newBomItem.type,
      colorLabel: (() => {
        const skuOptions = getSkuOptionsForCurrentSpu()
        const skuByCode = new Map(skuOptions.map((item) => [item.skuCode, item]))
        if (state.newBomItem.applicableSkuCodes.length === 0) return '全部SKU（当前未区分颜色）'
        if (state.newBomItem.colorLabel.trim()) return state.newBomItem.colorLabel.trim()
        const colors = dedupeStrings(
          state.newBomItem.applicableSkuCodes
            .map((skuCode) => skuByCode.get(skuCode)?.color || '')
            .filter((color) => color.trim().length > 0),
        )
        if (colors.length === 1) return colors[0]
        if (colors.length > 1) return '多颜色'
        return '未识别颜色'
      })(),
      materialCode: state.newBomItem.materialCode,
      materialName: state.newBomItem.materialName,
      spec: state.newBomItem.spec,
      patternPieces,
      linkedPatternIds,
      applicableSkuCodes: [...state.newBomItem.applicableSkuCodes],
      usageProcessCodes:
        state.newBomItem.usageProcessCodes.length > 0
          ? dedupeStrings([...state.newBomItem.usageProcessCodes])
          : [],
      usage: Number.parseFloat(state.newBomItem.usage) || 0,
      lossRate: Number.parseFloat(state.newBomItem.lossRate) || 0,
      printRequirement: state.newBomItem.printRequirement,
      dyeRequirement: state.newBomItem.dyeRequirement,
    }

    if (state.editBomItemId) {
      state.bomItems = state.bomItems.map((item) => (item.id === state.editBomItemId ? nextBom : item))
    } else {
      state.bomItems = [...state.bomItems, nextBom]
    }

    syncMaterialCostRows()
    syncTechPackToStore()
    state.addBomDialogOpen = false
    return true
  }
  if (action === 'delete-bom') {
    const bomId = actionNode.dataset.bomId
    if (!bomId) return true

    state.bomItems = state.bomItems.filter((item) => item.id !== bomId)
    syncMaterialCostRows()
    syncTechPackToStore()
    return true
  }

  if (action === 'add-custom-cost') {
    state.customCostRows = [
      ...state.customCostRows,
      {
        id: `custom-cost-${Date.now()}`,
        name: '',
        price: '',
        currency: '人民币',
        unit: '人民币/项',
        remark: '',
      },
    ]
    syncTechPackToStore({ touch: false })
    return true
  }

  if (action === 'delete-custom-cost') {
    const rowId = actionNode.dataset.rowId
    if (!rowId) return true
    state.customCostRows = state.customCostRows.filter((row) => row.id !== rowId)
    syncTechPackToStore({ touch: false })
    return true
  }

  if (action === 'confirm-color-mapping') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    state.colorMaterialMappings = state.colorMaterialMappings.map((item) =>
      item.id === mappingId
        ? {
            ...item,
            status:
              item.status === 'AUTO_DRAFT' || item.status === 'MANUAL_ADJUSTED'
                ? 'CONFIRMED'
                : item.status,
            confirmedBy: currentUser.name,
            confirmedAt: toTimestamp(),
          }
        : item,
    )
    syncTechPackToStore()
    return true
  }

  if (action === 'mark-color-mapping-manual') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    state.colorMaterialMappings = state.colorMaterialMappings.map((item) =>
      item.id === mappingId
        ? {
            ...item,
            status: 'MANUAL_ADJUSTED',
            generatedMode: 'MANUAL',
            confirmedBy: currentUser.name,
            confirmedAt: toTimestamp(),
            remark: item.remark || '已由技术员人工调整映射关系',
          }
        : item,
    )
    syncTechPackToStore()
    return true
  }

  if (action === 'copy-system-draft-manual') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    copySystemDraftToManual(mappingId)
    syncTechPackToStore()
    return true
  }

  if (action === 'reset-color-mapping-suggestion') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    resetColorMappingToSystemSuggestion(mappingId)
    syncTechPackToStore()
    return true
  }

  if (action === 'add-mapping-line') {
    const mappingId = actionNode.dataset.mappingId
    if (!mappingId) return true
    updateColorMapping(mappingId, (mapping) =>
      touchMappingAsManual({
        ...mapping,
        lines: [...mapping.lines, createEmptyMappingLine(mapping.id)],
      }),
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (action === 'delete-mapping-line') {
    const mappingId = actionNode.dataset.mappingId
    const lineId = actionNode.dataset.lineId
    if (!mappingId || !lineId) return true
    updateColorMapping(mappingId, (mapping) =>
      touchMappingAsManual({
        ...mapping,
        lines: mapping.lines.filter((line) => line.id !== lineId),
      }),
    )
    syncTechPackToStore({ touch: false })
    return true
  }

  if (action === 'open-add-technique') {
    const stage = actionNode.dataset.stage || stageOptions[0]
    resetTechniqueForm(stage)
    state.addTechniqueDialogOpen = true
    return true
  }
  if (action === 'close-add-technique') {
    state.addTechniqueDialogOpen = false
    return true
  }
  if (action === 'add-new-quality-check') {
    state.newTechnique.qualityChecks = [
      ...state.newTechnique.qualityChecks,
      { id: `qc-${Date.now()}`, name: '', required: true, standard: '' },
    ]
    state.newTechnique.enableQualityCheck = true
    return true
  }
  if (action === 'delete-new-quality-check') {
    const qcId = actionNode.dataset.qcId
    if (!qcId) return true
    state.newTechnique.qualityChecks = state.newTechnique.qualityChecks.filter((item) => item.id !== qcId)
    return true
  }
  if (action === 'save-technique') {
    if (!state.newTechnique.process || !state.newTechnique.technique) return true

    state.techniques = [
      ...state.techniques,
      {
        id: `tech-${Date.now()}`,
        stage: state.newTechnique.stage,
        process: state.newTechnique.process,
        technique: state.newTechnique.technique,
        standardTime: Number.parseFloat(state.newTechnique.standardTime) || 0,
        timeUnit: state.newTechnique.timeUnit,
        difficulty: state.newTechnique.difficulty,
        enableQualityCheck: state.newTechnique.enableQualityCheck,
        qualityChecks: state.newTechnique.qualityChecks.map((item) => ({ ...item })),
        remark: state.newTechnique.remark,
        source: '字典新增',
      },
    ]

    syncProcessCostRows()
    syncTechPackToStore()
    state.addTechniqueDialogOpen = false
    return true
  }
  if (action === 'delete-technique') {
    const techId = actionNode.dataset.techId
    if (!techId) return true

    state.techniques = state.techniques.filter((item) => item.id !== techId)
    syncProcessCostRows()
    syncTechPackToStore()
    return true
  }
  if (action === 'add-quality-check') {
    const techId = actionNode.dataset.techId
    if (!techId) return true

    updateTechnique(techId, (item) => ({
      ...item,
      qualityChecks: [
        ...item.qualityChecks,
        {
          id: `qc-${Date.now()}`,
          name: '',
          required: true,
          standard: '',
        },
      ],
    }))
    return true
  }
  if (action === 'delete-quality-check') {
    const techId = actionNode.dataset.techId
    const qcId = actionNode.dataset.qcId
    if (!techId || !qcId) return true

    updateTechnique(techId, (item) => ({
      ...item,
      qualityChecks: item.qualityChecks.filter((qc) => qc.id !== qcId),
    }))
    return true
  }

  if (action === 'open-add-size') {
    resetSizeForm()
    state.addSizeDialogOpen = true
    return true
  }
  if (action === 'close-add-size') {
    state.addSizeDialogOpen = false
    return true
  }
  if (action === 'save-size') {
    if (!state.techPack || !state.newSizeRow.part.trim()) return true

    const row: TechPackSizeRow = {
      id: `size-${Date.now()}`,
      part: state.newSizeRow.part,
      S: Number.parseFloat(state.newSizeRow.S) || 0,
      M: Number.parseFloat(state.newSizeRow.M) || 0,
      L: Number.parseFloat(state.newSizeRow.L) || 0,
      XL: Number.parseFloat(state.newSizeRow.XL) || 0,
      tolerance: Number.parseFloat(state.newSizeRow.tolerance) || 0,
    }

    state.techPack = {
      ...state.techPack,
      sizeTable: [...state.techPack.sizeTable, row],
    }

    syncTechPackToStore()
    state.addSizeDialogOpen = false
    return true
  }
  if (action === 'delete-size') {
    const sizeId = actionNode.dataset.sizeId
    if (!sizeId || !state.techPack) return true

    state.techPack = {
      ...state.techPack,
      sizeTable: state.techPack.sizeTable.filter((row) => row.id !== sizeId),
    }

    syncTechPackToStore()
    return true
  }

  if (action === 'open-add-design') {
    state.newDesignName = ''
    state.addDesignDialogOpen = true
    return true
  }
  if (action === 'close-add-design') {
    state.addDesignDialogOpen = false
    return true
  }
  if (action === 'save-design') {
    if (!state.techPack || !state.newDesignName.trim()) return true

    state.techPack = {
      ...state.techPack,
      patternDesigns: [
        ...state.techPack.patternDesigns,
        {
          id: `design-${Date.now()}`,
          name: state.newDesignName,
          imageUrl: '/placeholder.svg',
        },
      ],
    }

    syncTechPackToStore()
    state.addDesignDialogOpen = false
    return true
  }
  if (action === 'delete-design') {
    const designId = actionNode.dataset.designId
    if (!state.techPack || !designId) return true

    state.techPack = {
      ...state.techPack,
      patternDesigns: state.techPack.patternDesigns.filter((item) => item.id !== designId),
    }

    syncTechPackToStore()
    return true
  }

  if (action === 'open-add-attachment') {
    resetAttachmentForm()
    state.addAttachmentDialogOpen = true
    return true
  }
  if (action === 'close-add-attachment') {
    state.addAttachmentDialogOpen = false
    return true
  }
  if (action === 'save-attachment') {
    if (!state.techPack || !state.newAttachment.fileName.trim()) return true

    state.techPack = {
      ...state.techPack,
      attachments: [
        ...state.techPack.attachments,
        {
          id: `att-${Date.now()}`,
          fileName: state.newAttachment.fileName,
          fileType: state.newAttachment.fileType,
          fileSize: state.newAttachment.fileSize,
          uploadedAt: toTimestamp(),
          uploadedBy: currentUser.name,
          downloadUrl: '#',
        },
      ],
    }

    syncTechPackToStore()
    state.addAttachmentDialogOpen = false
    return true
  }
  if (action === 'delete-attachment') {
    const attachmentId = actionNode.dataset.attachmentId
    if (!state.techPack || !attachmentId) return true

    state.techPack = {
      ...state.techPack,
      attachments: state.techPack.attachments.filter((item) => item.id !== attachmentId),
    }

    syncTechPackToStore()
    return true
  }
  if (action === 'download-attachment') {
    return true
  }

  if (action === 'close-dialog') {
    closeAllDialogs()
    return true
  }

  if (action === 'noop') {
    return true
  }

  return false
}

export function isTechPackDialogOpen(): boolean {
  return (
    state.releaseDialogOpen ||
    state.addPatternDialogOpen ||
    state.addBomDialogOpen ||
    state.addTechniqueDialogOpen ||
    state.addSizeDialogOpen ||
    state.addDesignDialogOpen ||
    state.addAttachmentDialogOpen ||
    state.patternDialogOpen
  )
}
