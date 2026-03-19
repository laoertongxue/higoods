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
export type TechPackAssignmentGranularity = 'ORDER' | 'COLOR' | 'SKU'
export type TechPackProcessDocType = 'DEMAND' | 'TASK'
export type TechPackTaskTypeMode = 'PROCESS' | 'CRAFT'

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
  defaultDocType: TechPackProcessDocType
  taskTypeMode: TechPackTaskTypeMode
  isSpecialCraft: boolean
  triggerSource?: string
  standardTimeMinutes?: number
  timeUnit?: string
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
      {
        id: 'tpe-001-01',
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PREP',
        stageName: '准备阶段',
        processCode: 'PRINT',
        processName: '印花',
        assignmentGranularity: 'COLOR',
        defaultDocType: 'DEMAND',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        triggerSource: 'BOM上存在印花要求',
        standardTimeMinutes: 12,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
        remark: '准备阶段基线项，后续生成印花需求单。',
      },
      {
        id: 'tpe-001-02',
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
        standardTimeMinutes: 10,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
        remark: '准备阶段基线项，后续生成染色需求单。',
      },
      {
        id: 'tpe-001-03',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'CUT_PANEL',
        processName: '裁片',
        craftCode: 'CRAFT_000001',
        craftName: '定位裁',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 6,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
      },
      {
        id: 'tpe-001-04',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'PLEATING',
        processName: '压褶',
        craftCode: 'CRAFT_000004',
        craftName: '压褶',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 8,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-001-05',
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
        standardTimeMinutes: 14,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-001-06',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'SPECIAL_CRAFT',
        processName: '特殊工艺',
        craftCode: 'CRAFT_000008',
        craftName: '打揽',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'CRAFT',
        isSpecialCraft: true,
        standardTimeMinutes: 11,
        timeUnit: '分钟/件',
        difficulty: 'HIGH',
      },
      {
        id: 'tpe-001-07',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'SPECIAL_CRAFT',
        processName: '特殊工艺',
        craftCode: 'CRAFT_000064',
        craftName: '激光切',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'CRAFT',
        isSpecialCraft: true,
        standardTimeMinutes: 9,
        timeUnit: '分钟/件',
        difficulty: 'HIGH',
      },
      {
        id: 'tpe-001-08',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'SPECIAL_CRAFT',
        processName: '特殊工艺',
        craftCode: 'CRAFT_000032',
        craftName: '打条',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'CRAFT',
        isSpecialCraft: true,
        standardTimeMinutes: 10,
        timeUnit: '分钟/件',
        difficulty: 'HIGH',
      },
      {
        id: 'tpe-001-09',
        entryType: 'CRAFT',
        stageCode: 'POST',
        stageName: '后道阶段',
        processCode: 'WASHING',
        processName: '洗水',
        craftCode: 'CRAFT_000128',
        craftName: '洗水',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 16,
        timeUnit: '分钟/批',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-001-10',
        entryType: 'CRAFT',
        stageCode: 'POST',
        stageName: '后道阶段',
        processCode: 'BUTTONHOLE',
        processName: '开扣眼',
        craftCode: 'CRAFT_524288',
        craftName: '开扣眼',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 5,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
      },
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
    spuName: '女士连衣裙',
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
      {
        id: 'tpe-003-01',
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PREP',
        stageName: '准备阶段',
        processCode: 'PRINT',
        processName: '印花',
        assignmentGranularity: 'COLOR',
        defaultDocType: 'DEMAND',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        triggerSource: 'BOM上存在印花要求',
        standardTimeMinutes: 11,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-003-02',
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
        standardTimeMinutes: 10,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-003-03',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'SPECIAL_CRAFT',
        processName: '特殊工艺',
        craftCode: 'CRAFT_008192',
        craftName: '烫画',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'CRAFT',
        isSpecialCraft: true,
        standardTimeMinutes: 12,
        timeUnit: '分钟/件',
        difficulty: 'HIGH',
      },
      {
        id: 'tpe-003-04',
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
        standardTimeMinutes: 15,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-003-05',
        entryType: 'CRAFT',
        stageCode: 'POST',
        stageName: '后道阶段',
        processCode: 'WASHING',
        processName: '洗水',
        craftCode: 'CRAFT_000128',
        craftName: '洗水',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 18,
        timeUnit: '分钟/批',
        difficulty: 'MEDIUM',
      },
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
    spuName: '针织开衫',
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
    patternDesc: '宽松版型，落肩设计，前开扣设计',
    processes: [
      { id: 'p-9', seq: 1, name: '裁剪', timeMinutes: 6, difficulty: 'LOW', qcPoint: '检查尺寸' },
      { id: 'p-10', seq: 2, name: '缝合', timeMinutes: 15, difficulty: 'MEDIUM', qcPoint: '检查针距' },
      { id: 'p-11', seq: 3, name: '钉扣', timeMinutes: 5, difficulty: 'LOW', qcPoint: '检查位置' },
    ],
    processEntries: [
      {
        id: 'tpe-005-01',
        entryType: 'CRAFT',
        stageCode: 'PROD',
        stageName: '生产阶段',
        processCode: 'CUT_PANEL',
        processName: '裁片',
        craftCode: 'CRAFT_000001',
        craftName: '定位裁',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 7,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
      },
      {
        id: 'tpe-005-02',
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
      },
      {
        id: 'tpe-005-03',
        entryType: 'CRAFT',
        stageCode: 'POST',
        stageName: '后道阶段',
        processCode: 'BUTTON_ATTACH',
        processName: '钉扣',
        craftCode: 'CRAFT_032768',
        craftName: '布包扣',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 5,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
      },
    ],
    sizeTable: [
      { id: 's-8', part: '胸围', S: 100, M: 104, L: 108, XL: 112, tolerance: 4 },
      { id: 's-9', part: '衣长', S: 60, M: 62, L: 64, XL: 66, tolerance: 2 },
    ],
    bomItems: [
      {
        id: 'b-5',
        type: '面料',
        name: '针织罗纹（Grey）',
        spec: '280g/m²',
        colorLabel: 'Grey',
        unitConsumption: 0.9,
        lossRate: 3,
        supplier: 'PT Knit Jaya',
        applicableSkuCodes: ['SKU-005-S-GRY', 'SKU-005-M-GRY', 'SKU-005-L-GRY', 'SKU-005-XL-GRY'],
        usageProcessCodes: ['PROC_CUT', 'PROC_DYE'],
      },
      {
        id: 'b-6',
        type: '辅料',
        name: '纽扣',
        spec: '15mm',
        colorLabel: '全部SKU（当前未区分颜色）',
        unitConsumption: 6,
        lossRate: 2,
        supplier: 'CV Button Indo',
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
    spuName: '牛仔夹克',
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
      {
        id: 'tpe-006-01',
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
        standardTimeMinutes: 12,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-006-02',
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
        standardTimeMinutes: 9,
        timeUnit: '分钟/件',
        difficulty: 'MEDIUM',
      },
      {
        id: 'tpe-006-03',
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
        standardTimeMinutes: 18,
        timeUnit: '分钟/件',
        difficulty: 'HIGH',
      },
      {
        id: 'tpe-006-04',
        entryType: 'CRAFT',
        stageCode: 'POST',
        stageName: '后道阶段',
        processCode: 'WASHING',
        processName: '洗水',
        craftCode: 'CRAFT_000128',
        craftName: '洗水',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 28,
        timeUnit: '分钟/批',
        difficulty: 'HIGH',
      },
      {
        id: 'tpe-006-05',
        entryType: 'CRAFT',
        stageCode: 'POST',
        stageName: '后道阶段',
        processCode: 'HARDWARE',
        processName: '五金',
        craftCode: 'CRAFT_002048',
        craftName: '鸡眼扣',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 6,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
      },
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
    spuName: '准备阶段样例款',
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
    patternDesc: '准备阶段样例：仅验证印花与染色需求单生成。',
    processes: [],
    processEntries: [
      {
        id: 'tpe-017-01',
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PREP',
        stageName: '准备阶段',
        processCode: 'PRINT',
        processName: '印花',
        assignmentGranularity: 'COLOR',
        defaultDocType: 'DEMAND',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        triggerSource: 'BOM上存在印花要求',
        standardTimeMinutes: 6,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
        remark: '准备阶段仅生成印花需求单',
      },
      {
        id: 'tpe-017-02',
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
        standardTimeMinutes: 5,
        timeUnit: '分钟/件',
        difficulty: 'LOW',
        remark: '准备阶段仅生成染色需求单',
      },
    ],
    sizeTable: [
      { id: 's-17-1', part: '胸围', S: 94, M: 98, L: 102, XL: 106, tolerance: 2 },
    ],
    bomItems: [
      {
        id: 'b-17-1',
        type: '面料',
        name: '纯棉平纹布（Navy）',
        spec: '160g/m²',
        colorLabel: 'Navy',
        unitConsumption: 0.76,
        lossRate: 2,
        supplier: 'PT Textile Nusantara',
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

export function listTechPackProcessEntries(spuCode: string): TechPackProcessEntry[] {
  const techPack = getTechPackBySpuCode(spuCode)
  if (!techPack) return []
  return (techPack.processEntries ?? []).map((item) => ({ ...item }))
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
