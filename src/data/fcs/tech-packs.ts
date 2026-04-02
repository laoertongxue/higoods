import {
  PUBLISHED_SAM_UNIT_LABEL,
  getProcessCraftByCode,
  getProcessDefinitionByCode,
  listProcessCraftDefinitions,
  type PublishedSamUnit,
  type DetailSplitDimension,
  type DetailSplitMode,
  type RuleSource,
} from './process-craft-dict.ts'

export type TechPackStatus = 'MISSING' | 'BETA' | 'RELEASED'

export interface TechPackPatternFile {
  id: string
  fileName: string
  fileUrl: string
  uploadedAt: string
  uploadedBy: string
  // 纸样结构化信息（门幅单位：cm，排料长度单位：m，pieces 为裁片片数）
  linkedBomItemId?: string
  widthCm?: number
  markerLengthM?: number
  totalPieceCount?: number
  pieceRows?: Array<{
    id: string
    name: string
    count: number
    note?: string
    applicableSkuCodes?: string[]
  }>
}

export interface TechPackProcess {
  id: string
  seq: number
  name: string
  timeMinutes: number
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH'
  qcPoint: string
}

export type TechPackProcessEntryType = 'PROCESS_BASELINE' | 'CRAFT'
export type TechPackAssignmentGranularity = 'ORDER' | 'COLOR' | 'SKU' | 'DETAIL'
export type TechPackProcessDocType = 'DEMAND' | 'TASK'
export type TechPackTaskTypeMode = 'PROCESS' | 'CRAFT'
export type TechPackRuleSource = RuleSource
export type TechPackDetailSplitMode = DetailSplitMode
export type TechPackDetailSplitDimension = DetailSplitDimension

export interface TechPackProcessEntry {
  id: string
  entryType: TechPackProcessEntryType
  stageCode: 'PREP' | 'PROD' | 'POST'
  stageName: string
  processCode: string
  processName: string
  craftCode?: string
  craftName?: string
  assignmentGranularity: TechPackAssignmentGranularity
  ruleSource?: TechPackRuleSource
  detailSplitMode?: TechPackDetailSplitMode
  detailSplitDimensions?: TechPackDetailSplitDimension[]
  defaultDocType: TechPackProcessDocType
  taskTypeMode: TechPackTaskTypeMode
  isSpecialCraft: boolean
  triggerSource?: string
  standardTimeMinutes?: number
  timeUnit?: string
  referencePublishedSamValue?: number
  referencePublishedSamUnit?: PublishedSamUnit
  referencePublishedSamUnitLabel?: string
  referencePublishedSamNote?: string
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH'
  remark?: string
}

export interface TechPackSizeRow {
  id: string
  part: string
  S: number
  M: number
  L: number
  XL: number
  tolerance: number
}

export interface TechPackBomItem {
  id: string
  type: string
  name: string
  spec: string
  colorLabel?: string
  unitConsumption: number
  lossRate: number
  supplier: string
  printRequirement?: string
  dyeRequirement?: string
  // 适用 SKU 范围；为空表示默认适用全部 SKU
  applicableSkuCodes?: string[]
  // 与纸样形成结构化双向关联
  linkedPatternIds?: string[]
  // 当前 BOM 行用于哪些工序
  usageProcessCodes?: string[]
}

export type TechPackColorMappingStatus =
  | 'AUTO_CONFIRMED'
  | 'AUTO_DRAFT'
  | 'CONFIRMED'
  | 'MANUAL_ADJUSTED'

export type TechPackColorMappingGeneratedMode = 'AUTO' | 'MANUAL'

export interface TechPackColorMaterialMappingLine {
  id: string
  bomItemId?: string
  materialCode?: string
  materialName: string
  materialType: '面料' | '辅料' | '半成品' | '包装材料' | '其他'
  patternId?: string
  patternName?: string
  pieceId?: string
  pieceName?: string
  pieceCountPerUnit?: number
  unit: string
  applicableSkuCodes?: string[]
  sourceMode: TechPackColorMappingGeneratedMode
  note?: string
}

export interface TechPackColorMaterialMapping {
  id: string
  spuCode: string
  colorCode: string
  colorName: string
  status: TechPackColorMappingStatus
  generatedMode: TechPackColorMappingGeneratedMode
  confirmedBy?: string
  confirmedAt?: string
  remark?: string
  lines: TechPackColorMaterialMappingLine[]
}

export interface TechPackCustomCostItem {
  id: string
  name: string
  price: number
  currency: string
  unit: string
  remark?: string
  sort?: number
}

export interface TechPackMaterialCostItem {
  id: string
  bomItemId: string
  price: number
  currency: string
  unit: string
}

export interface TechPackProcessCostItem {
  id: string
  processId: string
  price: number
  currency: string
  unit: string
}

export interface TechPackSkuLine {
  skuCode: string
  color: string
  size: string
}

export interface TechPackPatternDesign {
  id: string
  name: string
  imageUrl: string
}

export interface TechPackAttachment {
  id: string
  fileName: string
  fileType: string
  fileSize: string
  uploadedAt: string
  uploadedBy: string
  downloadUrl: string
}

export interface TechPack {
  spuCode: string
  spuName: string
  status: TechPackStatus
  versionLabel: string
  completenessScore: number
  missingChecklist: string[]
  lastUpdatedAt: string
  lastUpdatedBy: string
  // 详细数据
  patternFiles: TechPackPatternFile[]
  patternDesc: string
  processes: TechPackProcess[]
  processEntries?: TechPackProcessEntry[]
  sizeTable: TechPackSizeRow[]
  bomItems: TechPackBomItem[]
  skuCatalog?: TechPackSkuLine[]
  materialCostItems?: TechPackMaterialCostItem[]
  processCostItems?: TechPackProcessCostItem[]
  customCostItems?: TechPackCustomCostItem[]
  colorMaterialMappings?: TechPackColorMaterialMapping[]
  patternDesigns: TechPackPatternDesign[]
  attachments: TechPackAttachment[]
}

// 计算完整度
export function calculateCompleteness(techPack: TechPack): { score: number; missing: string[] } {
  const missing: string[] = []
  let score = 0
  const weights = { pattern: 20, process: 25, size: 15, bom: 20, patternDesign: 10, attachment: 10 }
  
  if (techPack.patternFiles.length > 0 || techPack.patternDesc.trim()) {
    score += weights.pattern
  } else {
    missing.push('制版文件')
  }
  
  if (techPack.processes.length > 0) {
    score += weights.process
  } else {
    missing.push('工序表')
  }
  
  if (techPack.sizeTable.length > 0) {
    score += weights.size
  } else {
    missing.push('尺码表')
  }
  
  if (techPack.bomItems.length > 0) {
    score += weights.bom
  } else {
    missing.push('BOM物料')
  }
  
  if (techPack.patternDesigns.length > 0) {
    score += weights.patternDesign
  } else {
    missing.push('花型设计')
  }
  
  if (techPack.attachments.length > 0) {
    score += weights.attachment
  } else {
    missing.push('附件')
  }
  
  return { score, missing }
}

const STAGE_NAME_BY_CODE: Record<TechPackProcessEntry['stageCode'], string> = {
  PREP: '准备阶段',
  PROD: '生产阶段',
  POST: '后道阶段',
}

const processCraftByName = new Map(
  listProcessCraftDefinitions().map((item) => [item.craftName, item]),
)

function createCraftProcessEntry(
  id: string,
  craftName: string,
  standardTimeMinutes: number,
  difficulty: NonNullable<TechPackProcessEntry['difficulty']>,
  remark?: string,
): TechPackProcessEntry {
  const craft = processCraftByName.get(craftName)
  if (!craft) {
    throw new Error(`未找到工艺定义：${craftName}`)
  }
  const process = getProcessDefinitionByCode(craft.processCode)
  if (!process) {
    throw new Error(`未找到工序定义：${craft.processCode}`)
  }

  return {
    id,
    entryType: 'CRAFT',
    stageCode: craft.stageCode,
    stageName: STAGE_NAME_BY_CODE[craft.stageCode],
    processCode: craft.processCode,
    processName: process.processName,
    craftCode: craft.craftCode,
    craftName: craft.craftName,
    assignmentGranularity: craft.assignmentGranularity,
    ruleSource: craft.ruleSource,
    detailSplitMode: craft.detailSplitMode,
    detailSplitDimensions: [...craft.detailSplitDimensions],
    defaultDocType: craft.defaultDocType,
    taskTypeMode: craft.taskTypeMode,
    isSpecialCraft: craft.isSpecialCraft,
    standardTimeMinutes,
    timeUnit: PUBLISHED_SAM_UNIT_LABEL[craft.referencePublishedSamUnit],
    referencePublishedSamValue: craft.referencePublishedSamValue,
    referencePublishedSamUnit: craft.referencePublishedSamUnit,
    referencePublishedSamUnitLabel: PUBLISHED_SAM_UNIT_LABEL[craft.referencePublishedSamUnit],
    referencePublishedSamNote: craft.referencePublishedSamNote,
    difficulty,
    remark,
  }
}

// Mock 数据
export const techPacks: TechPack[] = [
  {
    spuCode: 'SPU-2024-001',
    spuName: '春季休闲T恤',
    status: 'RELEASED',
    versionLabel: 'v1.0',
    completenessScore: 100,
    missingChecklist: [],
    lastUpdatedAt: '2024-03-15 14:30:00',
    lastUpdatedBy: 'Budi Santoso',
    patternFiles: [
      {
        id: 'pf-1',
        fileName: '前片纸样.pdf',
        fileUrl: '#',
        uploadedAt: '2024-03-10',
        uploadedBy: 'Budi',
        linkedBomItemId: 'b-1',
        widthCm: 142,
        markerLengthM: 2.62,
        totalPieceCount: 6,
        pieceRows: [
          {
            id: 'pf-1-piece-1',
            name: '前片',
            count: 2,
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT', 'SKU-001-S-BLK', 'SKU-001-M-BLK', 'SKU-001-L-BLK', 'SKU-001-XL-BLK'],
          },
          {
            id: 'pf-1-piece-2',
            name: '门襟',
            count: 2,
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT', 'SKU-001-S-BLK', 'SKU-001-M-BLK', 'SKU-001-L-BLK', 'SKU-001-XL-BLK'],
          },
          {
            id: 'pf-1-piece-3',
            name: '口袋贴',
            count: 2,
            note: '可选口袋款',
            applicableSkuCodes: ['SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-M-BLK', 'SKU-001-L-BLK'],
          },
        ],
      },
      {
        id: 'pf-2',
        fileName: '后片纸样.pdf',
        fileUrl: '#',
        uploadedAt: '2024-03-10',
        uploadedBy: 'Budi',
        linkedBomItemId: 'b-1',
        widthCm: 142,
        markerLengthM: 2.2,
        totalPieceCount: 4,
        pieceRows: [
          {
            id: 'pf-2-piece-1',
            name: '后片',
            count: 2,
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT', 'SKU-001-S-BLK', 'SKU-001-M-BLK', 'SKU-001-L-BLK', 'SKU-001-XL-BLK'],
          },
          {
            id: 'pf-2-piece-2',
            name: '肩部补强片',
            count: 2,
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT', 'SKU-001-S-BLK', 'SKU-001-M-BLK', 'SKU-001-L-BLK', 'SKU-001-XL-BLK'],
          },
        ],
      },
      {
        id: 'pf-3',
        fileName: '拼接片纸样.pdf',
        fileUrl: '#',
        uploadedAt: '2024-03-11',
        uploadedBy: 'Budi',
        linkedBomItemId: 'b-3',
        widthCm: 138,
        markerLengthM: 1.16,
        totalPieceCount: 8,
        pieceRows: [
          {
            id: 'pf-3-piece-1',
            name: '左袖拼接片',
            count: 2,
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT'],
          },
          {
            id: 'pf-3-piece-2',
            name: '右袖拼接片',
            count: 2,
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT'],
          },
          {
            id: 'pf-3-piece-3',
            name: '下摆拼接片',
            count: 4,
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT'],
          },
        ],
      },
    ],
    patternDesc: '标准休闲版型，前后片分开裁剪，袖口收边处理',
    processes: [
      { id: 'p-1', seq: 1, name: '裁剪', timeMinutes: 5, difficulty: 'LOW', qcPoint: '检查尺寸' },
      { id: 'p-2', seq: 2, name: '缝合肩线', timeMinutes: 3, difficulty: 'MEDIUM', qcPoint: '检查针距' },
      { id: 'p-3', seq: 3, name: '上袖', timeMinutes: 8, difficulty: 'HIGH', qcPoint: '检查对称性' },
      { id: 'p-4', seq: 4, name: '缝合侧缝', timeMinutes: 4, difficulty: 'LOW', qcPoint: '检查平整度' },
      { id: 'p-5', seq: 5, name: '下摆处理', timeMinutes: 3, difficulty: 'LOW', qcPoint: '检查收边' },
    ],
    processEntries: [
      createCraftProcessEntry('tpe-001-01', '丝网印', 1.3, 'MEDIUM', '平台参考用于印花定位，当前款按 T 恤门幅略上调。'),
      createCraftProcessEntry('tpe-001-02', '匹染', 82, 'MEDIUM', '当前款主布统一按匹染准备。'),
      createCraftProcessEntry('tpe-001-03', '定位裁', 0.62, 'LOW', '当前款图案需要按定位裁执行。'),
      createCraftProcessEntry('tpe-001-04', '基础连接', 1.0, 'MEDIUM', '作为当前款主体缝制基线。'),
      createCraftProcessEntry('tpe-001-05', '包装', 0.33, 'LOW', '包装按独立袋装口径维护。'),
    ],
    sizeTable: [
      { id: 's-1', part: '胸围', S: 96, M: 100, L: 104, XL: 108, tolerance: 4 },
      { id: 's-2', part: '衣长', S: 68, M: 70, L: 72, XL: 74, tolerance: 2 },
      { id: 's-3', part: '肩宽', S: 42, M: 44, L: 46, XL: 48, tolerance: 2 },
    ],
    bomItems: [
      {
        id: 'b-1',
        type: '面料',
        name: '纯棉针织布（白色）',
        spec: '180g/m²',
        colorLabel: 'White',
        unitConsumption: 0.8,
        lossRate: 3,
        supplier: 'PT Textile Indo',
        printRequirement: '丝网印',
        dyeRequirement: '无',
        applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT'],
        linkedPatternIds: ['pf-1', 'pf-2'],
        usageProcessCodes: ['PROC_CUT'],
      },
      {
        id: 'b-2',
        type: '面料',
        name: '纯棉针织布（黑色）',
        spec: '180g/m²',
        colorLabel: 'Black',
        unitConsumption: 0.82,
        lossRate: 3.5,
        supplier: 'PT Textile Indo',
        printRequirement: '无',
        dyeRequirement: '无',
        applicableSkuCodes: ['SKU-001-S-BLK', 'SKU-001-M-BLK', 'SKU-001-L-BLK', 'SKU-001-XL-BLK'],
        linkedPatternIds: ['pf-1', 'pf-2'],
        usageProcessCodes: ['PROC_CUT'],
      },
      {
        id: 'b-3',
        type: '面料',
        name: '弹力罗纹拼接布（黑色）',
        spec: '220g/m²',
        colorLabel: 'White',
        unitConsumption: 0.16,
        lossRate: 5,
        supplier: 'CV Knit Delta',
        printRequirement: '无',
        dyeRequirement: '匹染',
        applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT'],
        linkedPatternIds: ['pf-3'],
        usageProcessCodes: ['PROC_CUT', 'PROC_SEW'],
      },
      {
        id: 'b-4',
        type: '辅料',
        name: '缝纫线',
        spec: '40s/2',
        colorLabel: '全部SKU（当前未区分颜色）',
        unitConsumption: 50,
        lossRate: 5,
        supplier: 'CV Thread Jaya',
        printRequirement: '无',
        dyeRequirement: '无',
        applicableSkuCodes: [],
        linkedPatternIds: [],
        usageProcessCodes: ['PROC_SEW'],
      },
      {
        id: 'b-5',
        type: '包装材料',
        name: '独立包装袋',
        spec: '35cm × 45cm',
        colorLabel: '全部SKU（当前未区分颜色）',
        unitConsumption: 1,
        lossRate: 2,
        supplier: 'PT Packindo',
        printRequirement: '无',
        dyeRequirement: '无',
        applicableSkuCodes: [],
        linkedPatternIds: [],
        usageProcessCodes: ['PROC_PACK'],
      },
    ],
    skuCatalog: [
      { skuCode: 'SKU-001-S-WHT', color: 'White', size: 'S' },
      { skuCode: 'SKU-001-M-WHT', color: 'White', size: 'M' },
      { skuCode: 'SKU-001-L-WHT', color: 'White', size: 'L' },
      { skuCode: 'SKU-001-XL-WHT', color: 'White', size: 'XL' },
      { skuCode: 'SKU-001-S-BLK', color: 'Black', size: 'S' },
      { skuCode: 'SKU-001-M-BLK', color: 'Black', size: 'M' },
      { skuCode: 'SKU-001-L-BLK', color: 'Black', size: 'L' },
      { skuCode: 'SKU-001-XL-BLK', color: 'Black', size: 'XL' },
    ],
    materialCostItems: [
      { id: 'mc-001-1', bomItemId: 'b-1', price: 23.6, currency: '人民币', unit: '人民币/米' },
      { id: 'mc-001-2', bomItemId: 'b-2', price: 24.2, currency: '人民币', unit: '人民币/米' },
      { id: 'mc-001-3', bomItemId: 'b-3', price: 18.5, currency: '人民币', unit: '人民币/米' },
      { id: 'mc-001-4', bomItemId: 'b-4', price: 0.32, currency: '人民币', unit: '人民币/件' },
      { id: 'mc-001-5', bomItemId: 'b-5', price: 0.45, currency: '人民币', unit: '人民币/件' },
    ],
    processCostItems: [
      { id: 'pc-001-1', processId: 'p-1', price: 0.85, currency: '人民币', unit: '人民币/件' },
      { id: 'pc-001-2', processId: 'p-2', price: 1.12, currency: '人民币', unit: '人民币/件' },
      { id: 'pc-001-3', processId: 'p-3', price: 1.8, currency: '人民币', unit: '人民币/件' },
      { id: 'pc-001-4', processId: 'p-4', price: 0.95, currency: '人民币', unit: '人民币/件' },
      { id: 'pc-001-5', processId: 'p-5', price: 0.66, currency: '人民币', unit: '人民币/件' },
    ],
    customCostItems: [
      { id: 'cc-001-1', name: '开版费分摊', price: 3600, currency: '人民币', unit: '人民币/批', remark: '按本批次总量均摊' },
      { id: 'cc-001-2', name: '包装辅材补贴', price: 0.25, currency: '人民币', unit: '人民币/件', remark: '特殊吊牌与防尘袋' },
      { id: 'cc-001-3', name: '印花菲林费', price: 420, currency: '人民币', unit: '人民币/项', remark: '白色与黑色共版' },
    ],
    colorMaterialMappings: [
      {
        id: 'MAP-001-WHT',
        spuCode: 'SPU-2024-001',
        colorCode: 'WHT',
        colorName: 'White',
        status: 'CONFIRMED',
        generatedMode: 'AUTO',
        confirmedBy: 'Budi Santoso',
        confirmedAt: '2026-03-18 11:20:00',
        remark: '复杂款中白色款已人工确认，车缝与后道由同厂连续处理同一 SKU。',
        lines: [
          {
            id: 'MAP-001-WHT-L1',
            bomItemId: 'b-1',
            materialCode: 'b-1',
            materialName: '纯棉针织布（白色）',
            materialType: '面料',
            patternId: 'pf-1',
            patternName: '前片纸样',
            pieceId: 'pf-1-piece-1',
            pieceName: '前片',
            pieceCountPerUnit: 2,
            unit: '片',
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT'],
            sourceMode: 'AUTO',
          },
          {
            id: 'MAP-001-WHT-L2',
            bomItemId: 'b-1',
            materialCode: 'b-1',
            materialName: '纯棉针织布（白色）',
            materialType: '面料',
            patternId: 'pf-2',
            patternName: '后片纸样',
            pieceId: 'pf-2-piece-1',
            pieceName: '后片',
            pieceCountPerUnit: 2,
            unit: '片',
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT'],
            sourceMode: 'AUTO',
          },
          {
            id: 'MAP-001-WHT-L3',
            bomItemId: 'b-4',
            materialCode: 'b-4',
            materialName: '缝纫线',
            materialType: '辅料',
            unit: '卷',
            applicableSkuCodes: ['SKU-001-S-WHT', 'SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-XL-WHT'],
            sourceMode: 'MANUAL',
            note: '车缝辅料，按后道同厂连续规则不重复承接上一步半成品',
          },
          {
            id: 'MAP-001-WHT-L4',
            bomItemId: 'b-3',
            materialCode: 'b-3',
            materialName: '拼接布（白色）',
            materialType: '面料',
            patternId: 'pf-3',
            patternName: '拼接片纸样',
            pieceId: 'pf-3-piece-1',
            pieceName: '左袖拼接片',
            pieceCountPerUnit: 2,
            unit: '片',
            applicableSkuCodes: ['SKU-001-M-WHT', 'SKU-001-L-WHT'],
            sourceMode: 'MANUAL',
            note: '白色款专属裁片，黑色款无此裁片',
          },
        ],
      },
      {
        id: 'MAP-001-BLK',
        spuCode: 'SPU-2024-001',
        colorCode: 'BLK',
        colorName: 'Black',
        status: 'AUTO_DRAFT',
        generatedMode: 'AUTO',
        remark: '多色复杂款，系统已生成草稿，待人工确认拼接片是否全部适用黑色 SKU。',
        lines: [
          {
            id: 'MAP-001-BLK-L1',
            bomItemId: 'b-2',
            materialCode: 'b-2',
            materialName: '纯棉针织布（黑色）',
            materialType: '面料',
            patternId: 'pf-1',
            patternName: '前片纸样',
            pieceId: 'pf-1-piece-1',
            pieceName: '前片',
            pieceCountPerUnit: 2,
            unit: '片',
            applicableSkuCodes: ['SKU-001-S-BLK', 'SKU-001-M-BLK', 'SKU-001-L-BLK', 'SKU-001-XL-BLK'],
            sourceMode: 'AUTO',
          },
          {
            id: 'MAP-001-BLK-L2',
            bomItemId: 'b-2',
            materialCode: 'b-2',
            materialName: '纯棉针织布（黑色）',
            materialType: '面料',
            patternId: 'pf-2',
            patternName: '后片纸样',
            pieceId: 'pf-2-piece-1',
            pieceName: '后片',
            pieceCountPerUnit: 2,
            unit: '片',
            applicableSkuCodes: ['SKU-001-S-BLK', 'SKU-001-M-BLK', 'SKU-001-L-BLK', 'SKU-001-XL-BLK'],
            sourceMode: 'AUTO',
          },
        ],
      },
    ],
    patternDesigns: [
      { id: 'pd-1', name: '胸前Logo', imageUrl: '/placeholder.svg' },
    ],
    attachments: [
      { id: 'a-1', fileName: '工艺说明书.pdf', fileType: 'PDF', fileSize: '2.3MB', uploadedAt: '2024-03-12', uploadedBy: 'Dewi', downloadUrl: '#' },
    ],
  },
  {
    spuCode: 'SPU-2024-002',
    spuName: '商务休闲裤',
    status: 'BETA',
    versionLabel: 'beta',
    completenessScore: 65,
    missingChecklist: ['花型设计', '附件'],
    lastUpdatedAt: '2024-03-18 10:00:00',
    lastUpdatedBy: 'Dewi Lestari',
    patternFiles: [
      { id: 'pf-3', fileName: '裤片纸样.pdf', fileUrl: '#', uploadedAt: '2024-03-16', uploadedBy: 'Dewi' },
    ],
    patternDesc: '商务休闲版型，直筒裤腿，腰头带扣设计',
    processes: [
      { id: 'p-6', seq: 1, name: '裁剪', timeMinutes: 6, difficulty: 'LOW', qcPoint: '检查对称' },
      { id: 'p-7', seq: 2, name: '缝合裤片', timeMinutes: 10, difficulty: 'MEDIUM', qcPoint: '检查缝线' },
      { id: 'p-8', seq: 3, name: '上腰头', timeMinutes: 8, difficulty: 'HIGH', qcPoint: '检查平整' },
    ],
    processEntries: [
      {
        id: 'tpe-002-01',
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PREP',
        stageName: '准备阶段',
        processCode: 'DYE',
        processName: '染色',
        assignmentGranularity: 'COLOR',
        defaultDocType: 'DEMAND',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        triggerSource: 'BOM上存在染色要求',
        standardTimeMinutes: 9,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-002-02',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'CUT_PANEL',
        processName: '裁片',
        craftCode: 'CRAFT_000016',
        craftName: '定向裁',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 7,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
      },
      {
        id: 'tpe-002-03',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'SEW',
        processName: '车缝',
        craftCode: 'CRAFT_262144',
        craftName: '曲牙',
        assignmentGranularity: 'SKU',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 13,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-002-04',
        entryType: 'CRAFT',
        stageCode: 'POST',
        stageName: '后道阶段',
        processCode: 'BUTTON_ATTACH',
        processName: '钉扣',
        craftCode: 'CRAFT_000512',
        craftName: '机打扣',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 4,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
      },
    ],
    sizeTable: [
      { id: 's-4', part: '腰围', S: 76, M: 80, L: 84, XL: 88, tolerance: 2 },
      { id: 's-5', part: '裤长', S: 100, M: 102, L: 104, XL: 106, tolerance: 2 },
    ],
    bomItems: [
      {
        id: 'b-3',
        type: '面料',
        name: '棉涤混纺（Grey）',
        spec: '250g/m²',
        colorLabel: 'Grey',
        unitConsumption: 1.2,
        lossRate: 4,
        supplier: 'PT Fabric Master',
        printRequirement: '无',
        dyeRequirement: '匹染',
        applicableSkuCodes: ['SKU-005-S-GRY', 'SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY'],
        usageProcessCodes: ['PROC_CUT', 'PROC_DYE'],
      },
      {
        id: 'b-3-a',
        type: '辅料',
        name: '腰头粘衬',
        spec: '90cm 门幅',
        colorLabel: '全部SKU（当前未区分颜色）',
        unitConsumption: 0.28,
        lossRate: 6,
        supplier: 'PT Interlining',
        printRequirement: '无',
        dyeRequirement: '无',
        applicableSkuCodes: [],
        usageProcessCodes: ['PROC_SEW', 'PROC_IRON'],
      },
    ],
    skuCatalog: [
      { skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S' },
      { skuCode: 'SKU-005-M-GRY', color: 'Grey', size: 'M' },
      { skuCode: 'SKU-005-L-GRY', color: 'Grey', size: 'L' },
      { skuCode: 'SKU-005-XL-GRY', color: 'Grey', size: 'XL' },
    ],
    customCostItems: [
      { id: 'cc-002-1', name: '特殊洗水费', price: 0.58, currency: '人民币', unit: '人民币/件' },
    ],
    colorMaterialMappings: [
      {
        id: 'MAP-002-GRY',
        spuCode: 'SPU-2024-002',
        colorCode: 'GRY',
        colorName: 'Grey',
        status: 'AUTO_CONFIRMED',
        generatedMode: 'AUTO',
        confirmedBy: 'Dewi Lestari',
        confirmedAt: '2026-03-15 09:30:00',
        remark: '单色简单款，系统自动生成并直接确认。',
        lines: [
          {
            id: 'MAP-002-GRY-L1',
            bomItemId: 'b-3',
            materialCode: 'b-3',
            materialName: '棉涤混纺（Grey）',
            materialType: '面料',
            patternId: 'pf-3',
            patternName: '裤片纸样',
            pieceName: '裤身片',
            pieceCountPerUnit: 4,
            unit: '片',
            applicableSkuCodes: ['SKU-005-S-GRY', 'SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY'],
            sourceMode: 'AUTO',
          },
          {
            id: 'MAP-002-GRY-L2',
            bomItemId: 'b-3-a',
            materialCode: 'b-3-a',
            materialName: '腰头粘衬',
            materialType: '辅料',
            unit: '米',
            applicableSkuCodes: ['SKU-005-S-GRY', 'SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY'],
            sourceMode: 'AUTO',
          },
        ],
      },
    ],
    patternDesigns: [],
    attachments: [],
  },
  {
    spuCode: 'SPU-2024-003',
    spuName: '女装褶皱连衣裙',
    status: 'BETA',
    versionLabel: 'beta',
    completenessScore: 45,
    missingChecklist: ['工序表', '花型设计', '附件'],
    lastUpdatedAt: '2024-03-20 09:15:00',
    lastUpdatedBy: 'Ahmad Wijaya',
    patternFiles: [
      { id: 'pf-4', fileName: '裙身纸样.pdf', fileUrl: '#', uploadedAt: '2024-03-19', uploadedBy: 'Ahmad' },
    ],
    patternDesc: 'A字裙版型，腰部收褶设计，裙摆自然垂坠',
    processes: [],
    processEntries: [
      createCraftProcessEntry('tpe-003-01', '数码印', 1.6, 'MEDIUM', '当前款裙身定位花型按数码印准备。'),
      createCraftProcessEntry('tpe-003-02', '压褶', 0.88, 'HIGH', '裙摆褶皱区按米维护当前款基线。'),
      createCraftProcessEntry('tpe-003-03', '曲牙', 1.5, 'MEDIUM', '肩颈与裙身连接按曲牙收口。'),
      createCraftProcessEntry('tpe-003-04', '手缝扣', 0.56, 'MEDIUM', '后领小扣按手缝扣处理。'),
      createCraftProcessEntry('tpe-003-05', '熨烫', 0.45, 'LOW', '后道整烫作为本款发布基线。'),
      createCraftProcessEntry('tpe-003-06', '包装', 0.34, 'LOW', '成衣入袋前按连衣裙折叠方式包装。'),
    ],
    sizeTable: [
      { id: 's-6', part: '胸围', S: 84, M: 88, L: 92, XL: 96, tolerance: 2 },
      { id: 's-7', part: '裙长', S: 90, M: 92, L: 94, XL: 96, tolerance: 2 },
    ],
    bomItems: [
      {
        id: 'b-4',
        type: '面料',
        name: '雪纺',
        spec: '100g/m²',
        colorLabel: 'Red',
        unitConsumption: 1.5,
        lossRate: 5,
        supplier: 'CV Chiffon Indo',
        printRequirement: '数码印',
        dyeRequirement: '无',
        applicableSkuCodes: ['SKU-003-S-RED', 'SKU-003-M-RED', 'SKU-003-L-RED', 'SKU-003-S-BLU', 'SKU-003-M-BLU', 'SKU-003-L-BLU'],
        usageProcessCodes: ['PROC_PRINT', 'PROC_DYE', 'PROC_CUT'],
      },
      {
        id: 'b-4-a',
        type: '辅料',
        name: '肩带调节扣',
        spec: '12mm',
        colorLabel: '全部SKU（当前未区分颜色）',
        unitConsumption: 2,
        lossRate: 3,
        supplier: 'CV Metal Basic',
        printRequirement: '无',
        dyeRequirement: '无',
        applicableSkuCodes: [],
        usageProcessCodes: ['PROC_SEW', 'PROC_PACK'],
      },
    ],
    skuCatalog: [
      { skuCode: 'SKU-003-S-RED', color: 'Red', size: 'S' },
      { skuCode: 'SKU-003-M-RED', color: 'Red', size: 'M' },
      { skuCode: 'SKU-003-L-RED', color: 'Red', size: 'L' },
      { skuCode: 'SKU-003-S-BLU', color: 'Blue', size: 'S' },
      { skuCode: 'SKU-003-M-BLU', color: 'Blue', size: 'M' },
      { skuCode: 'SKU-003-L-BLU', color: 'Blue', size: 'L' },
    ],
    colorMaterialMappings: [
      {
        id: 'MAP-003-RED',
        spuCode: 'SPU-2024-003',
        colorCode: 'RED',
        colorName: 'Red',
        status: 'AUTO_DRAFT',
        generatedMode: 'AUTO',
        remark: '多色复杂款，系统已生成红色草稿，待人工复核裁片映射。',
        lines: [
          {
            id: 'MAP-003-RED-L1',
            bomItemId: 'b-4',
            materialCode: 'b-4',
            materialName: '雪纺',
            materialType: '面料',
            patternId: 'pf-4',
            patternName: '裙身纸样',
            pieceName: '裙身主片',
            pieceCountPerUnit: 4,
            unit: '片',
            applicableSkuCodes: ['SKU-003-S-RED', 'SKU-003-M-RED', 'SKU-003-L-RED'],
            sourceMode: 'AUTO',
          },
        ],
      },
      {
        id: 'MAP-003-BLU',
        spuCode: 'SPU-2024-003',
        colorCode: 'BLU',
        colorName: 'Blue',
        status: 'MANUAL_ADJUSTED',
        generatedMode: 'MANUAL',
        confirmedBy: 'Ahmad Wijaya',
        confirmedAt: '2026-03-16 15:50:00',
        remark: '蓝色款拼接片和肩带辅料已人工调整，作为复杂款确认样例。',
        lines: [
          {
            id: 'MAP-003-BLU-L1',
            bomItemId: 'b-4',
            materialCode: 'b-4',
            materialName: '雪纺',
            materialType: '面料',
            patternId: 'pf-4',
            patternName: '裙身纸样',
            pieceName: '裙身主片',
            pieceCountPerUnit: 4,
            unit: '片',
            applicableSkuCodes: ['SKU-003-S-BLU', 'SKU-003-M-BLU', 'SKU-003-L-BLU'],
            sourceMode: 'MANUAL',
          },
          {
            id: 'MAP-003-BLU-L2',
            bomItemId: 'b-4-a',
            materialCode: 'b-4-a',
            materialName: '肩带调节扣',
            materialType: '辅料',
            unit: '个',
            applicableSkuCodes: ['SKU-003-S-BLU', 'SKU-003-M-BLU', 'SKU-003-L-BLU'],
            sourceMode: 'MANUAL',
            note: '人工确认蓝色款肩带需额外补强，系统草稿未覆盖',
          },
        ],
      },
    ],
    patternDesigns: [],
    attachments: [],
  },
  {
    spuCode: 'SPU-2024-004',
    spuName: '运动短裤',
    status: 'MISSING',
    versionLabel: '-',
    completenessScore: 0,
    missingChecklist: ['制版文件', '工序表', '尺码表', 'BOM物料', '花型设计', '附件'],
    lastUpdatedAt: '-',
    lastUpdatedBy: '-',
    patternFiles: [],
    patternDesc: '',
    processes: [],
    processEntries: [],
    sizeTable: [],
    bomItems: [],
    patternDesigns: [],
    attachments: [],
  },
  {
    spuCode: 'SPU-2024-005',
    spuName: '中式盘扣上衣',
    status: 'RELEASED',
    versionLabel: 'v1.2',
    completenessScore: 100,
    missingChecklist: [],
    lastUpdatedAt: '2024-03-22 16:45:00',
    lastUpdatedBy: 'Siti Rahayu',
    patternFiles: [
      { id: 'pf-5', fileName: '开衫前片.pdf', fileUrl: '#', uploadedAt: '2024-03-20', uploadedBy: 'Siti' },
      { id: 'pf-6', fileName: '开衫后片.pdf', fileUrl: '#', uploadedAt: '2024-03-20', uploadedBy: 'Siti' },
    ],
    patternDesc: '中式短款版型，门襟盘扣结构，局部装饰打条与绣饰工艺。',
    processes: [
      { id: 'p-9', seq: 1, name: '裁剪', timeMinutes: 6, difficulty: 'LOW', qcPoint: '检查尺寸' },
      { id: 'p-10', seq: 2, name: '缝合', timeMinutes: 15, difficulty: 'MEDIUM', qcPoint: '检查针距' },
      { id: 'p-11', seq: 3, name: '钉扣', timeMinutes: 5, difficulty: 'LOW', qcPoint: '检查位置' },
    ],
    processEntries: [
      createCraftProcessEntry('tpe-005-01', '贝壳绣', 2.5, 'HIGH', '门襟装饰按贝壳绣处理。'),
      createCraftProcessEntry('tpe-005-02', '打揽', 1.2, 'MEDIUM', '袖口收褶按打揽维护。'),
      createCraftProcessEntry('tpe-005-03', '打条', 0.8, 'MEDIUM', '门襟滚边按米维护。'),
      createCraftProcessEntry('tpe-005-04', '手工盘扣', 1.75, 'HIGH', '当前款核心识别工艺。'),
      createCraftProcessEntry('tpe-005-05', '布包扣', 0.48, 'MEDIUM', '备用装饰扣按布包扣维护。'),
      createCraftProcessEntry('tpe-005-06', '四爪扣', 0.35, 'LOW', '里襟定位扣按四爪扣维护。'),
      createCraftProcessEntry('tpe-005-07', '基础连接', 1.05, 'MEDIUM', '主体拼接仍使用基础连接基线。'),
      createCraftProcessEntry('tpe-005-08', '包装', 0.32, 'LOW', '成衣折叠包装。'),
    ],
    sizeTable: [
      { id: 's-8', part: '胸围', S: 100, M: 104, L: 108, XL: 112, tolerance: 4 },
      { id: 's-9', part: '衣长', S: 60, M: 62, L: 64, XL: 66, tolerance: 2 },
    ],
    bomItems: [
      {
        id: 'b-5',
        type: '面料',
        name: '提花棉麻主布（Grey）',
        spec: '220g/m²',
        colorLabel: 'Grey',
        unitConsumption: 0.9,
        lossRate: 3,
        supplier: 'PT Knit Jaya',
        printRequirement: '无',
        dyeRequirement: '无',
        applicableSkuCodes: ['SKU-005-S-GRY', 'SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY'],
        usageProcessCodes: ['PROC_CUT', 'PROC_DYE'],
      },
      {
        id: 'b-6',
        type: '辅料',
        name: '盘扣辅料组',
        spec: '手工盘扣 + 备用布包扣',
        colorLabel: '全部SKU（当前未区分颜色）',
        unitConsumption: 6,
        lossRate: 2,
        supplier: 'CV Button Indo',
        printRequirement: '无',
        dyeRequirement: '无',
        applicableSkuCodes: [],
        usageProcessCodes: ['PROC_SEW', 'PROC_PACK'],
      },
    ],
    skuCatalog: [
      { skuCode: 'SKU-005-S-GRY', color: 'Grey', size: 'S' },
      { skuCode: 'SKU-005-M-GRY', color: 'Grey', size: 'M' },
      { skuCode: 'SKU-005-L-GRY', color: 'Grey', size: 'L' },
      { skuCode: 'SKU-005-XL-GRY', color: 'Grey', size: 'XL' },
    ],
    customCostItems: [
      { id: 'cc-005-1', name: '开袋工艺附加费', price: 0.35, currency: '人民币', unit: '人民币/件' },
      { id: 'cc-005-2', name: '运输分摊', price: 180, currency: '人民币', unit: '人民币/批' },
    ],
    colorMaterialMappings: [
      {
        id: 'MAP-005-GRY',
        spuCode: 'SPU-2024-005',
        colorCode: 'GRY',
        colorName: 'Grey',
        status: 'AUTO_CONFIRMED',
        generatedMode: 'AUTO',
        confirmedBy: 'Siti Rahayu',
        confirmedAt: '2026-03-17 10:12:00',
        remark: '单色款自动确认示例：系统直接生成并可用于领料草稿。',
        lines: [
          {
            id: 'MAP-005-GRY-L1',
            bomItemId: 'b-5',
            materialCode: 'b-5',
            materialName: '针织罗纹（Grey）',
            materialType: '面料',
            patternId: 'pf-5',
            patternName: '开衫前片',
            pieceName: '前片',
            pieceCountPerUnit: 2,
            unit: '片',
            applicableSkuCodes: ['SKU-005-S-GRY', 'SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY'],
            sourceMode: 'AUTO',
            note: '同厂连续同一SKU时，后道不重复承接上一步半成品',
          },
        ],
      },
    ],
    patternDesigns: [
      { id: 'pd-2', name: '袖口花纹', imageUrl: '/placeholder.svg' },
    ],
    attachments: [
      { id: 'a-2', fileName: '针织工艺说明.pdf', fileType: 'PDF', fileSize: '1.8MB', uploadedAt: '2024-03-21', uploadedBy: 'Siti', downloadUrl: '#' },
    ],
  },
  {
    spuCode: 'SPU-2024-006',
    spuName: '牛仔水洗外套',
    status: 'BETA',
    versionLabel: 'beta',
    completenessScore: 80,
    missingChecklist: ['附件'],
    lastUpdatedAt: '2024-03-23 11:20:00',
    lastUpdatedBy: 'Hendra Kusuma',
    patternFiles: [
      { id: 'pf-7', fileName: '夹克纸样.pdf', fileUrl: '#', uploadedAt: '2024-03-22', uploadedBy: 'Hendra' },
    ],
    patternDesc: '经典牛仔夹克版型，双口袋设计，金属纽扣',
    processes: [
      { id: 'p-12', seq: 1, name: '裁剪', timeMinutes: 8, difficulty: 'MEDIUM', qcPoint: '检查纹路' },
      { id: 'p-13', seq: 2, name: '缝合', timeMinutes: 20, difficulty: 'HIGH', qcPoint: '检查针距' },
      { id: 'p-14', seq: 3, name: '钉扣', timeMinutes: 6, difficulty: 'LOW', qcPoint: '检查位置' },
      { id: 'p-15', seq: 4, name: '水洗', timeMinutes: 30, difficulty: 'HIGH', qcPoint: '检查色牢度' },
    ],
    processEntries: [
      createCraftProcessEntry('tpe-006-01', '定向裁', 0.62, 'MEDIUM', '牛仔纹路需要统一定向裁。'),
      createCraftProcessEntry('tpe-006-02', '绣花', 1.95, 'HIGH', '后背标识绣花按当前款上调。'),
      createCraftProcessEntry('tpe-006-03', '洗水', 78, 'HIGH', '牛仔做旧洗水按批次维护。'),
      createCraftProcessEntry('tpe-006-04', '鸡眼扣', 0.3, 'LOW', '抽绳孔位按鸡眼扣维护。'),
      createCraftProcessEntry('tpe-006-05', '开扣眼', 0.38, 'LOW', '前门襟扣眼基线。'),
      createCraftProcessEntry('tpe-006-06', '机打扣', 0.31, 'LOW', '门襟机打扣维护。'),
      createCraftProcessEntry('tpe-006-07', '熨烫', 0.46, 'LOW', '后道整烫。'),
      createCraftProcessEntry('tpe-006-08', '包装', 0.35, 'LOW', '外套折叠入袋。'),
    ],
    sizeTable: [
      { id: 's-10', part: '胸围', S: 104, M: 108, L: 112, XL: 116, tolerance: 4 },
      { id: 's-11', part: '衣长', S: 62, M: 64, L: 66, XL: 68, tolerance: 2 },
    ],
    bomItems: [
      {
        id: 'b-7',
        type: '面料',
        name: '牛仔布（Black）',
        spec: '12oz',
        colorLabel: 'Black',
        unitConsumption: 1.3,
        lossRate: 4,
        supplier: 'PT Denim Indo',
        printRequirement: '无',
        dyeRequirement: '成衣染',
        applicableSkuCodes: ['SKU-014-S-BLK', 'SKU-014-M-BLK', 'SKU-014-L-BLK', 'SKU-014-XL-BLK'],
        usageProcessCodes: ['PROC_CUT'],
      },
      {
        id: 'b-8',
        type: '辅料',
        name: '金属扣',
        spec: '17mm',
        colorLabel: '全部SKU（当前未区分颜色）',
        unitConsumption: 8,
        lossRate: 2,
        supplier: 'CV Metal Jaya',
        printRequirement: '无',
        dyeRequirement: '无',
        applicableSkuCodes: [],
        usageProcessCodes: ['PROC_PACK'],
      },
    ],
    skuCatalog: [
      { skuCode: 'SKU-014-S-BLK', color: 'Black', size: 'S' },
      { skuCode: 'SKU-014-M-BLK', color: 'Black', size: 'M' },
      { skuCode: 'SKU-014-L-BLK', color: 'Black', size: 'L' },
      { skuCode: 'SKU-014-XL-BLK', color: 'Black', size: 'XL' },
    ],
    customCostItems: [
      { id: 'cc-006-1', name: '做旧洗水附加费', price: 0.92, currency: '人民币', unit: '人民币/件' },
    ],
    colorMaterialMappings: [
      {
        id: 'MAP-006-BLK',
        spuCode: 'SPU-2024-006',
        colorCode: 'BLK',
        colorName: 'Black',
        status: 'CONFIRMED',
        generatedMode: 'AUTO',
        confirmedBy: 'Hendra Kusuma',
        confirmedAt: '2026-03-18 17:30:00',
        remark: '仓内后道样例：外部工序回仓后由仓内后道继续处理，不走外部工厂交接。',
        lines: [
          {
            id: 'MAP-006-BLK-L1',
            bomItemId: 'b-7',
            materialCode: 'b-7',
            materialName: '牛仔布（Black）',
            materialType: '面料',
            patternId: 'pf-7',
            patternName: '夹克纸样',
            pieceName: '衣身片',
            pieceCountPerUnit: 6,
            unit: '片',
            applicableSkuCodes: ['SKU-014-S-BLK', 'SKU-014-M-BLK', 'SKU-014-L-BLK', 'SKU-014-XL-BLK'],
            sourceMode: 'AUTO',
          },
        ],
      },
    ],
    patternDesigns: [
      { id: 'pd-3', name: '后背刺绣', imageUrl: '/placeholder.svg' },
    ],
    attachments: [],
  },
  {
    spuCode: 'SPU-2024-017',
    spuName: '运动功能外套',
    status: 'RELEASED',
    versionLabel: 'v1.0',
    completenessScore: 72,
    missingChecklist: ['工序表', '花型设计', '附件'],
    lastUpdatedAt: '2026-03-18 09:30:00',
    lastUpdatedBy: 'Yudi Prakoso',
    patternFiles: [
      {
        id: 'pf-17-1',
        fileName: '印花定位稿.pdf',
        fileUrl: '#',
        uploadedAt: '2026-03-15',
        uploadedBy: 'Yudi',
      },
    ],
    patternDesc: '功能面料运动外套，包含激光切、捆条、缩水与复合印花类工艺。',
    processes: [],
    processEntries: [
      createCraftProcessEntry('tpe-017-01', '色织', 98, 'MEDIUM', '功能面料色织主布按批次预处理。'),
      createCraftProcessEntry('tpe-017-02', '激光切', 1.08, 'HIGH', '反光片与透气孔位使用激光切。'),
      createCraftProcessEntry('tpe-017-03', '烫画', 0.76, 'MEDIUM', '胸前标识按烫画维护。'),
      createCraftProcessEntry('tpe-017-04', '直喷', 0.9, 'MEDIUM', '局部数字编号按直喷维护。'),
      createCraftProcessEntry('tpe-017-05', '捆条', 1.02, 'HIGH', '帽口与袖口按捆条收边。'),
      createCraftProcessEntry('tpe-017-06', '印花工艺', 1.38, 'HIGH', '特殊反光印花按工艺级任务维护。'),
      createCraftProcessEntry('tpe-017-07', '染色工艺', 92, 'HIGH', '功能染色工艺单独维护当前款基线。'),
      createCraftProcessEntry('tpe-017-08', '缩水', 68, 'MEDIUM', '主布上线前先做缩水预处理。'),
    ],
    sizeTable: [
      { id: 's-17-1', part: '胸围', S: 94, M: 98, L: 102, XL: 106, tolerance: 2 },
    ],
    bomItems: [
      {
        id: 'b-17-1',
        type: '面料',
        name: '功能复合面料（Navy）',
        spec: '180g/m² 防泼水',
        colorLabel: 'Navy',
        unitConsumption: 0.76,
        lossRate: 2,
        supplier: 'PT Textile Nusantara',
        printRequirement: '其他',
        dyeRequirement: '其他',
        applicableSkuCodes: ['SKU-017-S-NVY', 'SKU-017-M-NVY', 'SKU-017-L-NVY', 'SKU-017-XL-NVY'],
        usageProcessCodes: ['PROC_PRINT', 'PROC_DYE'],
      },
    ],
    skuCatalog: [
      { skuCode: 'SKU-017-S-NVY', color: 'Navy', size: 'S' },
      { skuCode: 'SKU-017-M-NVY', color: 'Navy', size: 'M' },
      { skuCode: 'SKU-017-L-NVY', color: 'Navy', size: 'L' },
      { skuCode: 'SKU-017-XL-NVY', color: 'Navy', size: 'XL' },
    ],
    materialCostItems: [
      { id: 'mc-017-1', bomItemId: 'b-17-1', price: 21.4, currency: '人民币', unit: '人民币/米' },
    ],
    processCostItems: [],
    customCostItems: [{ id: 'cc-017-1', name: '印花开版费', price: 300, currency: '人民币', unit: '人民币/项' }],
    colorMaterialMappings: [
      {
        id: 'MAP-017-NVY',
        spuCode: 'SPU-2024-017',
        colorCode: 'NVY',
        colorName: 'Navy',
        status: 'AUTO_CONFIRMED',
        generatedMode: 'AUTO',
        confirmedBy: 'Yudi Prakoso',
        confirmedAt: '2026-03-18 09:35:00',
        lines: [
          {
            id: 'MAP-017-NVY-L1',
            bomItemId: 'b-17-1',
            materialCode: 'b-17-1',
            materialName: '纯棉平纹布（Navy）',
            materialType: '面料',
            unit: '米',
            applicableSkuCodes: ['SKU-017-S-NVY', 'SKU-017-M-NVY', 'SKU-017-L-NVY', 'SKU-017-XL-NVY'],
            sourceMode: 'AUTO',
          },
        ],
      },
    ],
    patternDesigns: [],
    attachments: [],
  },
]

type SupplementalCuttingMaterialType = 'PRINT' | 'DYE' | 'SOLID' | 'LINING'

interface SupplementalPieceRowConfig {
  id: string
  name: string
  count: number
}

interface SupplementalMaterialMappingConfig {
  id: string
  materialCode: string
  materialName: string
  materialType: SupplementalCuttingMaterialType
  applicableSkuCodes: string[]
  pieceId: string
  pieceName: string
  pieceCountPerUnit: number
}

interface SupplementalReleasedTechPackConfig {
  spuCode: string
  spuName: string
  versionLabel: string
  lastUpdatedAt: string
  skuCatalog: TechPackSkuLine[]
  pieceRows: SupplementalPieceRowConfig[]
  materialMappings: SupplementalMaterialMappingConfig[]
}

function toSupplementalBomType(materialType: SupplementalCuttingMaterialType): string {
  return materialType === 'LINING' ? '辅料' : '面料'
}

function toSupplementalColorCode(colorName: string): string {
  const alnum = colorName.replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, '')
  if (!alnum) return 'MIX'
  return alnum.slice(0, 6).toUpperCase()
}

function createSupplementalProcessEntries(
  config: SupplementalReleasedTechPackConfig,
): TechPackProcessEntry[] {
  const entries: TechPackProcessEntry[] = []
  const materialTypes = new Set(config.materialMappings.map((item) => item.materialType))

  if (materialTypes.has('PRINT')) {
    entries.push({
      id: `${config.spuCode}-prep-print`,
      entryType: 'PROCESS_BASELINE',
      stageCode: 'PREP',
      stageName: '准备阶段',
      processCode: 'PRINT',
      processName: '印花',
      assignmentGranularity: 'COLOR',
      defaultDocType: 'DEMAND',
      taskTypeMode: 'PROCESS',
      isSpecialCraft: false,
      triggerSource: 'BOM上存在印花面料',
      standardTimeMinutes: 8,
      timeUnit: '分钟/件',
      difficulty: 'MEDIUM',
    })
  }

  if (materialTypes.has('DYE')) {
    entries.push({
      id: `${config.spuCode}-prep-dye`,
      entryType: 'PROCESS_BASELINE',
      stageCode: 'PREP',
      stageName: '准备阶段',
      processCode: 'DYE',
      processName: '染色',
      assignmentGranularity: 'COLOR',
      defaultDocType: 'DEMAND',
      taskTypeMode: 'PROCESS',
      isSpecialCraft: false,
      triggerSource: 'BOM上存在染色面料',
      standardTimeMinutes: 6,
      timeUnit: '分钟/件',
      difficulty: 'LOW',
    })
  }

  entries.push({
    id: `${config.spuCode}-prod-sew`,
    entryType: 'CRAFT',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processCode: 'SEW',
    processName: '车缝',
    craftCode: 'CRAFT_262144',
    craftName: '曲牙',
    assignmentGranularity: 'SKU',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    standardTimeMinutes: 12,
    timeUnit: '分钟/件',
    difficulty: 'MEDIUM',
  })

  return entries
}

function createSupplementalReleasedTechPack(config: SupplementalReleasedTechPackConfig): TechPack {
  const patternId = `${config.spuCode}-pattern-main`
  const patternName = `${config.spuName} 结构纸样`
  const bomItems = config.materialMappings.map((mapping, index) => ({
    id: `${config.spuCode}-bom-${index + 1}`,
    type: toSupplementalBomType(mapping.materialType),
    name: mapping.materialName,
    spec: mapping.materialType === 'LINING' ? '里辅料标准' : '主布标准',
    colorLabel: '按 SKU 适配',
    unitConsumption: Number((mapping.pieceCountPerUnit * 0.28).toFixed(2)),
    lossRate: 4,
    supplier: 'HiGood Mock Supplier',
    printRequirement: mapping.materialType === 'PRINT' ? '按技术包印花要求' : '无',
    dyeRequirement: mapping.materialType === 'DYE' ? '按技术包染色要求' : '无',
    applicableSkuCodes: [...mapping.applicableSkuCodes],
    linkedPatternIds: [patternId],
    usageProcessCodes:
      mapping.materialType === 'PRINT'
        ? ['PROC_PRINT', 'PROC_CUT']
        : mapping.materialType === 'DYE'
          ? ['PROC_DYE', 'PROC_CUT']
          : ['PROC_CUT'],
  }))

  const colorGroups = new Map<string, SupplementalMaterialMappingConfig[]>()
  config.skuCatalog.forEach((sku) => {
    const mappings = config.materialMappings.filter((item) => item.applicableSkuCodes.includes(sku.skuCode))
    if (!mappings.length) return
    const current = colorGroups.get(sku.color) ?? []
    mappings.forEach((mapping) => {
      if (!current.includes(mapping)) current.push(mapping)
    })
    colorGroups.set(sku.color, current)
  })

  const colorMaterialMappings: TechPackColorMaterialMapping[] = Array.from(colorGroups.entries()).map(
    ([colorName, mappings]) => ({
      id: `${config.spuCode}-${toSupplementalColorCode(colorName)}`,
      spuCode: config.spuCode,
      colorCode: toSupplementalColorCode(colorName),
      colorName,
      status: 'CONFIRMED',
      generatedMode: 'MANUAL',
      confirmedBy: 'System',
      confirmedAt: config.lastUpdatedAt,
      remark: '为打通生产需求 → 技术包 → 生产单 → 原始裁片单链路补齐的结构化技术包映射。',
      lines: mappings.map((mapping, index) => ({
        id: `${config.spuCode}-${toSupplementalColorCode(colorName)}-line-${index + 1}`,
        bomItemId: bomItems.find((item) => item.name === mapping.materialName && item.linkedPatternIds?.[0] === patternId)?.id,
        materialCode: mapping.materialCode,
        materialName: mapping.materialName,
        materialType: mapping.materialType === 'LINING' ? '辅料' : '面料',
        patternId,
        patternName,
        pieceId: mapping.pieceId,
        pieceName: mapping.pieceName,
        pieceCountPerUnit: mapping.pieceCountPerUnit,
        unit: '片',
        applicableSkuCodes: config.skuCatalog
          .filter((sku) => sku.color === colorName && mapping.applicableSkuCodes.includes(sku.skuCode))
          .map((sku) => sku.skuCode),
        sourceMode: 'MANUAL',
        note: '上游链补齐生成',
      })),
    }),
  )

  return {
    spuCode: config.spuCode,
    spuName: config.spuName,
    status: 'RELEASED',
    versionLabel: config.versionLabel,
    completenessScore: 100,
    missingChecklist: [],
    lastUpdatedAt: config.lastUpdatedAt,
    lastUpdatedBy: 'System',
    patternFiles: [
      {
        id: patternId,
        fileName: `${config.spuCode}-pattern.pdf`,
        fileUrl: '#',
        uploadedAt: config.lastUpdatedAt,
        uploadedBy: 'System',
        linkedBomItemId: bomItems[0]?.id,
        widthCm: 160,
        markerLengthM: 8.4,
        totalPieceCount: config.pieceRows.reduce((sum, row) => sum + row.count, 0),
        pieceRows: config.pieceRows.map((row) => ({
          id: row.id,
          name: row.name,
          count: row.count,
        })),
      },
    ],
    patternDesc: `${config.spuName} 结构化裁片与物料映射补齐版本`,
    processes: [],
    processEntries: createSupplementalProcessEntries(config),
    sizeTable: [
      { id: `${config.spuCode}-size-1`, part: '胸围', S: 94, M: 98, L: 102, XL: 106, tolerance: 2 },
      { id: `${config.spuCode}-size-2`, part: '衣长', S: 66, M: 68, L: 70, XL: 72, tolerance: 2 },
    ],
    bomItems,
    skuCatalog: [...config.skuCatalog],
    materialCostItems: bomItems.map((item, index) => ({
      id: `${config.spuCode}-mc-${index + 1}`,
      bomItemId: item.id,
      price: 18 + index * 2,
      currency: '人民币',
      unit: '人民币/米',
    })),
    processCostItems: [],
    customCostItems: [],
    colorMaterialMappings,
    patternDesigns: [],
    attachments: [],
  }
}

const supplementalReleasedTechPackConfigs: SupplementalReleasedTechPackConfig[] = [
  {
    spuCode: 'SPU-2024-004',
    spuName: 'Kaos Polos Premium',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-02 16:00:00',
    skuCatalog: [
      { skuCode: 'SKU-004-S-WHT', color: 'White', size: 'S' },
      { skuCode: 'SKU-004-M-WHT', color: 'White', size: 'M' },
      { skuCode: 'SKU-004-L-WHT', color: 'White', size: 'L' },
      { skuCode: 'SKU-004-XL-WHT', color: 'White', size: 'XL' },
    ],
    pieceRows: [
      { id: 'front', name: '前片', count: 1 },
      { id: 'back', name: '后片', count: 1 },
      { id: 'sleeve-left', name: '左袖', count: 1 },
      { id: 'sleeve-right', name: '右袖', count: 1 },
    ],
    materialMappings: [
      {
        id: 'main',
        materialCode: 'FAB-SKU-004-BASE',
        materialName: '高支平纹主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-004-S-WHT', 'SKU-004-M-WHT', 'SKU-004-L-WHT', 'SKU-004-XL-WHT'],
        pieceId: 'front',
        pieceName: '前后片套裁',
        pieceCountPerUnit: 4,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-008',
    spuName: 'Kemeja Flanel Pria',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-04 11:00:00',
    skuCatalog: [
      { skuCode: 'SKU-008-S-PLB', color: 'Plaid Blue', size: 'S' },
      { skuCode: 'SKU-008-M-PLB', color: 'Plaid Blue', size: 'M' },
      { skuCode: 'SKU-008-L-PLB', color: 'Plaid Blue', size: 'L' },
      { skuCode: 'SKU-008-XL-PLB', color: 'Plaid Blue', size: 'XL' },
    ],
    pieceRows: [
      { id: 'shirt-front', name: '前片', count: 2 },
      { id: 'shirt-back', name: '后片', count: 1 },
      { id: 'shirt-collar', name: '领片', count: 2 },
    ],
    materialMappings: [
      {
        id: 'plaid-main',
        materialCode: 'FAB-SKU-008-PLAID',
        materialName: '法兰绒格纹主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-008-S-PLB', 'SKU-008-M-PLB', 'SKU-008-L-PLB', 'SKU-008-XL-PLB'],
        pieceId: 'shirt-front',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-009',
    spuName: 'Polo Shirt Pique',
    versionLabel: 'v1.2',
    lastUpdatedAt: '2026-03-01 10:00:00',
    skuCatalog: [
      { skuCode: 'SKU-009-S-WHT', color: 'White', size: 'S' },
      { skuCode: 'SKU-009-M-WHT', color: 'White', size: 'M' },
      { skuCode: 'SKU-009-L-WHT', color: 'White', size: 'L' },
      { skuCode: 'SKU-009-XL-WHT', color: 'White', size: 'XL' },
    ],
    pieceRows: [
      { id: 'polo-front', name: '前片', count: 1 },
      { id: 'polo-back', name: '后片', count: 1 },
    ],
    materialMappings: [
      {
        id: 'polo-main',
        materialCode: 'FAB-SKU-009-PIQUE',
        materialName: '珠地网眼主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-009-S-WHT', 'SKU-009-M-WHT', 'SKU-009-L-WHT', 'SKU-009-XL-WHT'],
        pieceId: 'polo-front',
        pieceName: '前后片',
        pieceCountPerUnit: 2,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-010',
    spuName: 'Celana Jogger Pria',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-02 16:00:00',
    skuCatalog: [
      { skuCode: 'SKU-010-S-BLK', color: 'Black', size: 'S' },
      { skuCode: 'SKU-010-M-BLK', color: 'Black', size: 'M' },
      { skuCode: 'SKU-010-L-BLK', color: 'Black', size: 'L' },
      { skuCode: 'SKU-010-XL-BLK', color: 'Black', size: 'XL' },
    ],
    pieceRows: [
      { id: 'pants-left', name: '左裤片', count: 1 },
      { id: 'pants-right', name: '右裤片', count: 1 },
    ],
    materialMappings: [
      {
        id: 'pants-main',
        materialCode: 'FAB-SKU-010-JOGGER',
        materialName: '针织卫裤主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-010-S-BLK', 'SKU-010-M-BLK', 'SKU-010-L-BLK', 'SKU-010-XL-BLK'],
        pieceId: 'pants-left',
        pieceName: '裤身片',
        pieceCountPerUnit: 2,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-011',
    spuName: 'Sweater Rajut Wanita',
    versionLabel: 'v1.1',
    lastUpdatedAt: '2026-03-01 14:00:00',
    skuCatalog: [
      { skuCode: 'SKU-011-S-CRM', color: 'Cream', size: 'S' },
      { skuCode: 'SKU-011-M-CRM', color: 'Cream', size: 'M' },
      { skuCode: 'SKU-011-L-CRM', color: 'Cream', size: 'L' },
      { skuCode: 'SKU-011-XL-CRM', color: 'Cream', size: 'XL' },
    ],
    pieceRows: [
      { id: 'knit-front', name: '前片', count: 1 },
      { id: 'knit-back', name: '后片', count: 1 },
      { id: 'knit-sleeve', name: '袖片', count: 2 },
    ],
    materialMappings: [
      {
        id: 'knit-main',
        materialCode: 'FAB-SKU-011-KNIT',
        materialName: '羊毛混纺主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-011-S-CRM', 'SKU-011-M-CRM', 'SKU-011-L-CRM', 'SKU-011-XL-CRM'],
        pieceId: 'knit-front',
        pieceName: '前后袖片',
        pieceCountPerUnit: 4,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-012',
    spuName: 'Cardigan Wanita',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-02 15:00:00',
    skuCatalog: [
      { skuCode: 'SKU-012-S-BEG', color: 'Beige', size: 'S' },
      { skuCode: 'SKU-012-M-BEG', color: 'Beige', size: 'M' },
      { skuCode: 'SKU-012-L-BEG', color: 'Beige', size: 'L' },
      { skuCode: 'SKU-012-XL-BEG', color: 'Beige', size: 'XL' },
    ],
    pieceRows: [
      { id: 'cardigan-front', name: '前片', count: 2 },
      { id: 'cardigan-back', name: '后片', count: 1 },
    ],
    materialMappings: [
      {
        id: 'cardigan-main',
        materialCode: 'FAB-SKU-012-KNIT',
        materialName: '开衫针织主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-012-S-BEG', 'SKU-012-M-BEG', 'SKU-012-L-BEG', 'SKU-012-XL-BEG'],
        pieceId: 'cardigan-front',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-013',
    spuName: 'Jas Pria Formal',
    versionLabel: 'v1.5',
    lastUpdatedAt: '2026-03-03 11:00:00',
    skuCatalog: [
      { skuCode: 'SKU-013-S-NVY', color: 'Navy', size: 'S' },
      { skuCode: 'SKU-013-M-NVY', color: 'Navy', size: 'M' },
      { skuCode: 'SKU-013-L-NVY', color: 'Navy', size: 'L' },
      { skuCode: 'SKU-013-XL-NVY', color: 'Navy', size: 'XL' },
    ],
    pieceRows: [
      { id: 'blazer-front-left', name: '左前片', count: 1 },
      { id: 'blazer-front-right', name: '右前片', count: 1 },
      { id: 'blazer-back', name: '后片', count: 1 },
    ],
    materialMappings: [
      {
        id: 'blazer-main',
        materialCode: 'FAB-SKU-013-SUIT',
        materialName: '西装精纺主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-013-S-NVY', 'SKU-013-M-NVY', 'SKU-013-L-NVY', 'SKU-013-XL-NVY'],
        pieceId: 'blazer-front-left',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-014',
    spuName: 'Rompi Pria Casual',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-04 09:00:00',
    skuCatalog: [
      { skuCode: 'SKU-014-S-GRN', color: 'Green', size: 'S' },
      { skuCode: 'SKU-014-M-GRN', color: 'Green', size: 'M' },
      { skuCode: 'SKU-014-L-GRN', color: 'Green', size: 'L' },
      { skuCode: 'SKU-014-XL-GRN', color: 'Green', size: 'XL' },
    ],
    pieceRows: [
      { id: 'vest-front', name: '前片', count: 2 },
      { id: 'vest-back', name: '后片', count: 1 },
    ],
    materialMappings: [
      {
        id: 'vest-main',
        materialCode: 'FAB-SKU-014-VEST',
        materialName: '轻量背心主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-014-S-GRN', 'SKU-014-M-GRN', 'SKU-014-L-GRN', 'SKU-014-XL-GRN'],
        pieceId: 'vest-front',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-015',
    spuName: 'Kemeja Linen Pria',
    versionLabel: 'v1.3',
    lastUpdatedAt: '2026-03-04 14:30:00',
    skuCatalog: [
      { skuCode: 'SKU-015-S-WHT', color: 'White', size: 'S' },
      { skuCode: 'SKU-015-M-WHT', color: 'White', size: 'M' },
      { skuCode: 'SKU-015-L-WHT', color: 'White', size: 'L' },
      { skuCode: 'SKU-015-XL-WHT', color: 'White', size: 'XL' },
    ],
    pieceRows: [
      { id: 'linen-front', name: '前片', count: 2 },
      { id: 'linen-back', name: '后片', count: 1 },
      { id: 'linen-collar', name: '领片', count: 2 },
    ],
    materialMappings: [
      {
        id: 'linen-main',
        materialCode: 'FAB-SKU-015-LINEN',
        materialName: '亚麻主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-015-S-WHT', 'SKU-015-M-WHT', 'SKU-015-L-WHT', 'SKU-015-XL-WHT'],
        pieceId: 'linen-front',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
    ],
  },
  {
    spuCode: 'SPU-2024-016',
    spuName: 'Blus Wanita Satin',
    versionLabel: 'v1.1',
    lastUpdatedAt: '2026-03-01 16:00:00',
    skuCatalog: [
      { skuCode: 'SKU-016-S-CHP', color: 'Champagne', size: 'S' },
      { skuCode: 'SKU-016-M-CHP', color: 'Champagne', size: 'M' },
      { skuCode: 'SKU-016-L-CHP', color: 'Champagne', size: 'L' },
      { skuCode: 'SKU-016-XL-CHP', color: 'Champagne', size: 'XL' },
    ],
    pieceRows: [
      { id: 'blouse-front', name: '前片', count: 1 },
      { id: 'blouse-back', name: '后片', count: 1 },
      { id: 'blouse-sleeve', name: '袖片', count: 2 },
    ],
    materialMappings: [
      {
        id: 'blouse-main',
        materialCode: 'FAB-SKU-016-SATIN',
        materialName: '缎面主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-016-S-CHP', 'SKU-016-M-CHP', 'SKU-016-L-CHP', 'SKU-016-XL-CHP'],
        pieceId: 'blouse-front',
        pieceName: '前后袖片',
        pieceCountPerUnit: 4,
      },
    ],
  },
  {
    spuCode: 'SPU-TSHIRT-081',
    spuName: '春季休闲印花短袖 T 恤',
    versionLabel: 'v2.0',
    lastUpdatedAt: '2026-03-15 09:10:00',
    skuCatalog: [
      { skuCode: 'SKU-001-M-WHT', color: 'White', size: 'M' },
      { skuCode: 'SKU-001-L-WHT', color: 'White', size: 'L' },
      { skuCode: 'SKU-001-M-BLK', color: 'Black', size: 'M' },
      { skuCode: 'SKU-001-L-BLK', color: 'Black', size: 'L' },
      { skuCode: 'SKU-081-M-RSE', color: '玫瑰红', size: 'M' },
      { skuCode: 'SKU-081-L-RSE', color: '玫瑰红', size: 'L' },
      { skuCode: 'SKU-081-M-RSE-2', color: '玫瑰红补单', size: 'M' },
      { skuCode: 'SKU-081-L-RSE-2', color: '玫瑰红补单', size: 'L' },
    ],
    pieceRows: [
      { id: 'tee-front', name: '前片', count: 1 },
      { id: 'tee-back', name: '后片', count: 1 },
      { id: 'tee-neck', name: '领口拼接片', count: 1 },
    ],
    materialMappings: [
      {
        id: 'tee-white-main',
        materialCode: 'FAB-SKU-PRINT-001',
        materialName: '白色印花主布',
        materialType: 'PRINT',
        applicableSkuCodes: ['SKU-001-M-WHT', 'SKU-001-L-WHT'],
        pieceId: 'tee-front',
        pieceName: '前后片',
        pieceCountPerUnit: 2,
      },
      {
        id: 'tee-black-main',
        materialCode: 'FAB-SKU-PRINT-001-B',
        materialName: '黑色印花主布',
        materialType: 'PRINT',
        applicableSkuCodes: ['SKU-001-M-BLK', 'SKU-001-L-BLK'],
        pieceId: 'tee-front',
        pieceName: '前后片',
        pieceCountPerUnit: 2,
      },
      {
        id: 'tee-white-lining',
        materialCode: 'FAB-SKU-LINING-001',
        materialName: '白色里辅料',
        materialType: 'LINING',
        applicableSkuCodes: ['SKU-001-M-WHT', 'SKU-001-L-WHT', 'SKU-001-M-BLK', 'SKU-001-L-BLK'],
        pieceId: 'tee-neck',
        pieceName: '领口拼接片',
        pieceCountPerUnit: 1,
      },
      {
        id: 'tee-rose-main',
        materialCode: 'FAB-SKU-SOLID-033',
        materialName: '玫瑰红主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-081-M-RSE', 'SKU-081-L-RSE'],
        pieceId: 'tee-front',
        pieceName: '前后片',
        pieceCountPerUnit: 2,
      },
      {
        id: 'tee-rose-lining',
        materialCode: 'FAB-SKU-LINING-007',
        materialName: '玫瑰红配套里布',
        materialType: 'LINING',
        applicableSkuCodes: ['SKU-081-M-RSE', 'SKU-081-L-RSE'],
        pieceId: 'tee-neck',
        pieceName: '领口拼接片',
        pieceCountPerUnit: 1,
      },
      {
        id: 'tee-rose-replenish-main',
        materialCode: 'FAB-SKU-PRINT-031',
        materialName: '玫瑰红补单印花主布',
        materialType: 'PRINT',
        applicableSkuCodes: ['SKU-081-M-RSE-2', 'SKU-081-L-RSE-2'],
        pieceId: 'tee-front',
        pieceName: '前后片',
        pieceCountPerUnit: 2,
      },
      {
        id: 'tee-rose-replenish-contrast',
        materialCode: 'FAB-SKU-PRINT-033',
        materialName: '玫瑰红补单拼接布',
        materialType: 'PRINT',
        applicableSkuCodes: ['SKU-081-M-RSE-2', 'SKU-081-L-RSE-2'],
        pieceId: 'tee-neck',
        pieceName: '领口拼接片',
        pieceCountPerUnit: 1,
      },
    ],
  },
  {
    spuCode: 'SPU-HOODIE-082',
    spuName: '连帽拉链卫衣套装',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-09 09:00:00',
    skuCatalog: [
      { skuCode: 'SKU-082-S-GRY', color: '雾霾灰', size: 'S' },
      { skuCode: 'SKU-082-M-GRY', color: '雾霾灰', size: 'M' },
      { skuCode: 'SKU-082-L-GRY', color: '雾霾灰', size: 'L' },
      { skuCode: 'SKU-082-XL-GRY', color: '雾霾灰', size: 'XL' },
    ],
    pieceRows: [
      { id: 'hoodie-front', name: '前片', count: 2 },
      { id: 'hoodie-back', name: '后片', count: 1 },
    ],
    materialMappings: [
      {
        id: 'hoodie-main-a',
        materialCode: 'FAB-SKU-SOLID-014',
        materialName: '雾霾灰主布 A',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-082-S-GRY', 'SKU-082-M-GRY'],
        pieceId: 'hoodie-front',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
      {
        id: 'hoodie-main-b',
        materialCode: 'FAB-SKU-SOLID-014-B',
        materialName: '雾霾灰主布 B',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-082-L-GRY', 'SKU-082-XL-GRY'],
        pieceId: 'hoodie-front',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
    ],
  },
  {
    spuCode: 'SPU-DRESS-083',
    spuName: '春季定位印花连衣裙',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-10 09:10:00',
    skuCatalog: [
      { skuCode: 'SKU-083-S-RED', color: 'Red', size: 'S' },
      { skuCode: 'SKU-083-M-RED', color: 'Red', size: 'M' },
      { skuCode: 'SKU-083-L-RED', color: 'Red', size: 'L' },
    ],
    pieceRows: [
      { id: 'dress-body', name: '裙身主片', count: 4 },
      { id: 'dress-placket', name: '门襟片', count: 2 },
    ],
    materialMappings: [
      {
        id: 'dress-main',
        materialCode: 'FAB-SKU-DYE-022',
        materialName: '定位印染色主布',
        materialType: 'DYE',
        applicableSkuCodes: ['SKU-083-S-RED', 'SKU-083-M-RED', 'SKU-083-L-RED'],
        pieceId: 'dress-body',
        pieceName: '裙身主片',
        pieceCountPerUnit: 4,
      },
      {
        id: 'dress-placket',
        materialCode: 'FAB-SKU-PRINT-008',
        materialName: '门襟拼色布',
        materialType: 'PRINT',
        applicableSkuCodes: ['SKU-083-S-RED', 'SKU-083-M-RED', 'SKU-083-L-RED'],
        pieceId: 'dress-placket',
        pieceName: '门襟片',
        pieceCountPerUnit: 2,
      },
    ],
  },
  {
    spuCode: 'SPU-TEE-084',
    spuName: '针织撞色短袖上衣',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-11 09:00:00',
    skuCatalog: [
      { skuCode: 'SKU-084-S-CRL', color: '珊瑚粉', size: 'S' },
      { skuCode: 'SKU-084-M-CRL', color: '珊瑚粉', size: 'M' },
      { skuCode: 'SKU-084-L-CRL', color: '珊瑚粉', size: 'L' },
      { skuCode: 'SKU-084-XL-CRL', color: '珊瑚粉', size: 'XL' },
    ],
    pieceRows: [
      { id: 'tee84-body', name: '衣身片', count: 2 },
      { id: 'tee84-lining', name: '里料片', count: 2 },
    ],
    materialMappings: [
      {
        id: 'tee84-lining',
        materialCode: 'FAB-SKU-LINING-003',
        materialName: '弹力网布里料',
        materialType: 'LINING',
        applicableSkuCodes: ['SKU-084-S-CRL', 'SKU-084-M-CRL', 'SKU-084-L-CRL', 'SKU-084-XL-CRL'],
        pieceId: 'tee84-lining',
        pieceName: '里料片',
        pieceCountPerUnit: 2,
      },
      {
        id: 'tee84-print',
        materialCode: 'FAB-SKU-PRINT-017',
        materialName: '撞色主布',
        materialType: 'PRINT',
        applicableSkuCodes: ['SKU-084-S-CRL', 'SKU-084-M-CRL', 'SKU-084-L-CRL', 'SKU-084-XL-CRL'],
        pieceId: 'tee84-body',
        pieceName: '衣身片',
        pieceCountPerUnit: 2,
      },
    ],
  },
  {
    spuCode: 'SPU-JACKET-085',
    spuName: '户外轻量夹克',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-12 08:50:00',
    skuCatalog: [
      { skuCode: 'SKU-085-S-OLV', color: '军绿', size: 'S' },
      { skuCode: 'SKU-085-M-OLV', color: '军绿', size: 'M' },
      { skuCode: 'SKU-085-L-OLV', color: '军绿', size: 'L' },
      { skuCode: 'SKU-085-XL-OLV', color: '军绿', size: 'XL' },
    ],
    pieceRows: [
      { id: 'jacket-body', name: '前后片', count: 3 },
      { id: 'jacket-pocket', name: '口袋片', count: 2 },
    ],
    materialMappings: [
      {
        id: 'jacket-main',
        materialCode: 'FAB-SKU-SOLID-021',
        materialName: '夹克主布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-085-S-OLV', 'SKU-085-M-OLV', 'SKU-085-L-OLV', 'SKU-085-XL-OLV'],
        pieceId: 'jacket-body',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
      {
        id: 'jacket-pocket',
        materialCode: 'FAB-SKU-SOLID-021-B',
        materialName: '口袋辅布',
        materialType: 'SOLID',
        applicableSkuCodes: ['SKU-085-S-OLV', 'SKU-085-M-OLV', 'SKU-085-L-OLV', 'SKU-085-XL-OLV'],
        pieceId: 'jacket-pocket',
        pieceName: '口袋片',
        pieceCountPerUnit: 2,
      },
    ],
  },
  {
    spuCode: 'SPU-SHIRT-086',
    spuName: '商务修身长袖衬衫',
    versionLabel: 'v1.0',
    lastUpdatedAt: '2026-03-13 08:35:00',
    skuCatalog: [
      { skuCode: 'SKU-086-S-BLU', color: '蓝白印花', size: 'S' },
      { skuCode: 'SKU-086-M-BLU', color: '蓝白印花', size: 'M' },
      { skuCode: 'SKU-086-L-BLU', color: '蓝白印花', size: 'L' },
      { skuCode: 'SKU-086-XL-BLU', color: '蓝白印花', size: 'XL' },
    ],
    pieceRows: [
      { id: 'shirt86-body', name: '前后片', count: 3 },
      { id: 'shirt86-hem', name: '下摆辅布片', count: 2 },
    ],
    materialMappings: [
      {
        id: 'shirt86-main',
        materialCode: 'FAB-SKU-DYE-009',
        materialName: '蓝白印花主布',
        materialType: 'DYE',
        applicableSkuCodes: ['SKU-086-S-BLU', 'SKU-086-M-BLU', 'SKU-086-L-BLU', 'SKU-086-XL-BLU'],
        pieceId: 'shirt86-body',
        pieceName: '前后片',
        pieceCountPerUnit: 3,
      },
      {
        id: 'shirt86-hem',
        materialCode: 'FAB-SKU-PRINT-021',
        materialName: '下摆辅布',
        materialType: 'PRINT',
        applicableSkuCodes: ['SKU-086-S-BLU', 'SKU-086-M-BLU', 'SKU-086-L-BLU', 'SKU-086-XL-BLU'],
        pieceId: 'shirt86-hem',
        pieceName: '下摆辅布片',
        pieceCountPerUnit: 2,
      },
    ],
  },
]

function applySupplementalReleasedTechPacks(): void {
  supplementalReleasedTechPackConfigs.forEach((config) => {
    const existing = getTechPackBySpuCode(config.spuCode)
    const nextPack = createSupplementalReleasedTechPack(config)
    if (existing) {
      updateTechPack(config.spuCode, nextPack)
      return
    }
    techPacks.push(nextPack)
  })
}

applySupplementalReleasedTechPacks()

// 根据SPU获取技术包
export function getTechPackBySpuCode(spuCode: string): TechPack | undefined {
  return techPacks.find(tp => tp.spuCode === spuCode)
}

// 创建空白beta技术包
export function createBetaTechPack(spuCode: string, spuName: string): TechPack {
  return {
    spuCode,
    spuName,
    status: 'BETA',
    versionLabel: 'beta',
    completenessScore: 0,
    missingChecklist: ['制版文件', '工序表', '尺码表', 'BOM物料', '花型设计', '附件'],
    lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    lastUpdatedBy: 'System',
    patternFiles: [],
    patternDesc: '',
    processes: [],
    sizeTable: [],
    bomItems: [],
    skuCatalog: [],
    materialCostItems: [],
    processCostItems: [],
    customCostItems: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
  }
}

// 获取或创建技术包（如果不存在则创建beta版本）
export function getOrCreateTechPack(spuCode: string, spuName?: string): TechPack {
  let techPack = getTechPackBySpuCode(spuCode)
  if (!techPack) {
    // 如果没有提供spuName，尝试从已有的MISSING技术包或使用spuCode
    const finalSpuName = spuName || spuCode
    techPack = createBetaTechPack(spuCode, finalSpuName)
    techPacks.push(techPack)
  }
  return techPack
}

// 更新技术包
export function updateTechPack(spuCode: string, updates: Partial<TechPack>): TechPack | undefined {
  const index = techPacks.findIndex(tp => tp.spuCode === spuCode)
  if (index === -1) return undefined
  techPacks[index] = { ...techPacks[index], ...updates }
  return techPacks[index]
}

function fallbackDetailDimensions(
  granularity: TechPackAssignmentGranularity,
): TechPackDetailSplitDimension[] {
  if (granularity === 'SKU') return ['GARMENT_SKU']
  if (granularity === 'COLOR') return ['GARMENT_COLOR', 'MATERIAL_SKU']
  return ['PATTERN', 'MATERIAL_SKU']
}

export function resolveTechPackProcessEntryRule(entry: TechPackProcessEntry): TechPackProcessEntry {
  const processDef = getProcessDefinitionByCode(entry.processCode)
  const craftDef = entry.craftCode ? getProcessCraftByCode(entry.craftCode) : undefined
  const referencePublishedSamUnitLabel = craftDef
    ? PUBLISHED_SAM_UNIT_LABEL[craftDef.referencePublishedSamUnit]
    : undefined

  const inheritedGranularity = (processDef?.assignmentGranularity ??
    entry.assignmentGranularity ??
    'ORDER') as TechPackAssignmentGranularity
  const inheritedSplitMode = processDef?.detailSplitMode ?? entry.detailSplitMode ?? 'COMPOSITE'
  const inheritedSplitDimensions =
    processDef?.detailSplitDimensions?.length
      ? [...processDef.detailSplitDimensions]
      : entry.detailSplitDimensions && entry.detailSplitDimensions.length > 0
        ? [...entry.detailSplitDimensions]
        : fallbackDetailDimensions(inheritedGranularity)

  const forcedInherit = entry.entryType === 'PROCESS_BASELINE'
  const forcedOverride = entry.entryType === 'CRAFT' && (entry.isSpecialCraft || craftDef?.isSpecialCraft)
  const defaultRuleSource: TechPackRuleSource = forcedOverride
    ? 'OVERRIDE_CRAFT'
    : craftDef?.ruleSource ?? 'INHERIT_PROCESS'
  const resolvedRuleSource: TechPackRuleSource = forcedInherit
    ? 'INHERIT_PROCESS'
    : forcedOverride
      ? 'OVERRIDE_CRAFT'
      : entry.ruleSource ?? defaultRuleSource

  const overrideGranularity = (entry.assignmentGranularity ??
    craftDef?.assignmentGranularity ??
    inheritedGranularity) as TechPackAssignmentGranularity
  const overrideSplitMode = entry.detailSplitMode ?? craftDef?.detailSplitMode ?? inheritedSplitMode
  const overrideSplitDimensions =
    entry.detailSplitDimensions && entry.detailSplitDimensions.length > 0
      ? [...entry.detailSplitDimensions]
      : craftDef?.detailSplitDimensions && craftDef.detailSplitDimensions.length > 0
        ? [...craftDef.detailSplitDimensions]
        : fallbackDetailDimensions(overrideGranularity)

  const resolvedGranularity =
    resolvedRuleSource === 'OVERRIDE_CRAFT' ? overrideGranularity : inheritedGranularity
  const resolvedSplitMode =
    resolvedRuleSource === 'OVERRIDE_CRAFT' ? overrideSplitMode : inheritedSplitMode
  const resolvedSplitDimensions =
    resolvedRuleSource === 'OVERRIDE_CRAFT' ? overrideSplitDimensions : inheritedSplitDimensions

  return {
    ...entry,
    assignmentGranularity: resolvedGranularity,
    ruleSource: resolvedRuleSource,
    detailSplitMode: resolvedSplitMode,
    detailSplitDimensions: resolvedSplitDimensions,
    timeUnit:
      entry.entryType === 'CRAFT' && referencePublishedSamUnitLabel
        ? referencePublishedSamUnitLabel
        : entry.timeUnit,
    referencePublishedSamValue: craftDef?.referencePublishedSamValue,
    referencePublishedSamUnit: craftDef?.referencePublishedSamUnit,
    referencePublishedSamUnitLabel,
    referencePublishedSamNote: craftDef?.referencePublishedSamNote,
  }
}

export function listTechPackProcessEntries(spuCode: string): TechPackProcessEntry[] {
  const techPack = getTechPackBySpuCode(spuCode)
  if (!techPack) return []
  return (techPack.processEntries ?? []).map((item) => resolveTechPackProcessEntryRule(item))
}

export function getTechPackProcessEntryById(spuCode: string, entryId: string): TechPackProcessEntry | null {
  const entries = listTechPackProcessEntries(spuCode)
  return entries.find((item) => item.id === entryId) ?? null
}

export function listTechPackProcessEntriesByStage(
  spuCode: string,
  stageCode: TechPackProcessEntry['stageCode'],
): TechPackProcessEntry[] {
  return listTechPackProcessEntries(spuCode).filter((item) => item.stageCode === stageCode)
}

export function listTechPackProcessEntriesByProcess(
  spuCode: string,
  processCode: string,
): TechPackProcessEntry[] {
  return listTechPackProcessEntries(spuCode).filter((item) => item.processCode === processCode)
}
