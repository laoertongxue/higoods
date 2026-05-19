import {
  PUBLISHED_SAM_UNIT_LABEL,
  getSpecialCraftSupportedTargetObjectLabels,
  getSpecialCraftTargetObjectLabel,
  getProcessCraftByCode,
  getProcessDefinitionByCode,
  normalizeSpecialCraftTargetObjectLabel,
  listProcessCraftDefinitions,
  type PublishedSamUnit,
  type DetailSplitDimension,
  type DetailSplitMode,
  type RuleSource,
  type SpecialCraftSupportedTargetObject,
  type SpecialCraftTargetObjectLabel,
  type SpecialCraftVisibleFactoryType,
} from './process-craft-dict.ts'

// 旧 FCS 本地技术包 mock 数据已清空；生产链路统一读取生产需求单当前正式技术包。
export type TechPackStatus = 'DRAFT' | 'ENABLED' | 'DISABLED'
export type TechPackSpecialCraftTargetObject = SpecialCraftTargetObjectLabel

export const TECH_PACK_STATUS_LABEL: Record<TechPackStatus, string> = {
  DRAFT: '草稿',
  ENABLED: '已启用',
  DISABLED: '未启用',
}

export type TechPackPatternMaterialType = 'WOVEN' | 'WOOL' | 'UNKNOWN'
export type TechPackPatternFileMode = 'PAIRED_DXF_RUL' | 'SINGLE_FILE'
export type TechPackPatternParseStatus =
  | 'NOT_PARSED'
  | 'PARSING'
  | 'PARSED'
  | 'FAILED'
  | 'NOT_REQUIRED'
export type TechPackPatternMaintainerStepStatus =
  | '待跟单维护'
  | '待版师维护'
  | '待解析'
  | '已解析待确认'
  | '已完成'
export type TechPackPatternInfoStatus = '未填写' | '已填写' | '待解析' | '已解析'
export type TechPackPatternPieceSourceType = 'PARSED_PATTERN' | 'MANUAL'
export type TechPackPatternDesignSideType = 'FRONT' | 'INSIDE'

export const TECH_PACK_PATTERN_MATERIAL_TYPE_LABELS: Record<TechPackPatternMaterialType, string> = {
  WOVEN: '布料纸样',
  WOOL: '毛织纸样',
  UNKNOWN: '暂无数据',
}

export const TECH_PACK_PATTERN_PARSE_STATUS_LABELS: Record<TechPackPatternParseStatus, string> = {
  NOT_PARSED: '待解析',
  PARSING: '解析中',
  PARSED: '已解析',
  FAILED: '解析失败',
  NOT_REQUIRED: '无需解析',
}

export const TECH_PACK_PATTERN_CATEGORY_OPTIONS = ['主体片', '结构片', '装饰片', '其他'] as const
export type TechPackPatternCategory = (typeof TECH_PACK_PATTERN_CATEGORY_OPTIONS)[number]

export interface TechPackPatternPieceColorAllocation {
  id: string
  colorName: string
  colorCode?: string
  skuCodes?: string[]
  pieceCount: number
}

export interface TechPackPatternColorPieceQuantity {
  colorId: string
  colorName: string
  pieceQty: number
  enabled: boolean
  remark?: string
}

export interface TechPackPatternPieceSpecialCraft {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  displayName: string
  selectedTargetObject: TechPackSpecialCraftTargetObject
  supportedTargetObjects: SpecialCraftSupportedTargetObject[]
  supportedTargetObjectLabels: SpecialCraftTargetObjectLabel[]
}

export type TechPackPatternPieceCraftPosition = 'LEFT' | 'RIGHT' | 'BOTTOM' | 'FACE'
export type TechPackPatternPieceCraftPositionName = '左' | '右' | '底' | '面'
export type TechPackPatternPieceInstanceStatus = '未配置' | '已配置' | '待确认'

export interface TechPackPatternPieceSpecialCraftAssignment {
  assignmentId: string
  craftCode: string
  craftName: string
  craftCategory?: 'AUXILIARY' | 'SPECIAL'
  craftCategoryName?: '辅助工艺' | '特种工艺'
  targetObject?: 'CUT_PIECE_PART' | 'FABRIC' | 'ACCESSORY'
  targetObjectName?: '裁片部位' | '面料' | '辅料'
  craftPosition: TechPackPatternPieceCraftPosition
  craftPositionName: TechPackPatternPieceCraftPositionName
  remark?: string
  createdBy?: string
  updatedAt?: string
}

export interface TechPackPatternPieceInstance {
  pieceInstanceId: string
  sourcePieceId: string
  pieceName: string
  sizeName?: string
  colorId: string
  colorName: string
  sequenceNo: number
  displayName: string
  specialCraftAssignments: TechPackPatternPieceSpecialCraftAssignment[]
  status: TechPackPatternPieceInstanceStatus
}

export interface TechPackPatternPieceRow {
  id: string
  name: string
  /** 兼容旧裁床/特殊工艺链路。纸样管理页面不再直接编辑该字段，保存时由 totalPieceQty 回写。 */
  count: number
  note?: string
  isTemplate?: boolean
  partTemplateId?: string
  partTemplateName?: string
  partTemplatePreviewSvg?: string
  partTemplateShapeDescription?: string
  applicableSkuCodes?: string[]
  colorAllocations?: TechPackPatternPieceColorAllocation[]
  specialCrafts?: TechPackPatternPieceSpecialCraft[]
  bundleLengthCm?: number
  bundleWidthCm?: number
  sourceType?: TechPackPatternPieceSourceType
  missingName?: boolean
  missingCount?: boolean
  sourcePartName?: string
  systemPieceName?: string
  candidatePartNames?: string[]
  sizeCode?: string
  parsedQuantity?: number
  colorPieceQuantities?: TechPackPatternColorPieceQuantity[]
  totalPieceQty?: number
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
}

export interface TechPackPatternManagedFile {
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: string
  uploadedBy: string
  previewUrl?: string
}

export interface TechPackPatternBindingStrip {
  bindingStripId: string
  bindingStripNo: string
  bindingStripName: string
  lengthCm: number
  widthCm: number
  relatedMaterialId?: string
  remark?: string
  createdBy?: string
  updatedAt?: string
}

export interface TechPackPatternFile {
  id: string
  patternName?: string
  patternCategory?: TechPackPatternCategory | string
  patternMaterialType?: TechPackPatternMaterialType
  patternMaterialTypeLabel?: string
  patternFileMode?: TechPackPatternFileMode
  fileName: string
  fileUrl: string
  uploadedAt: string
  uploadedBy: string
  dxfFileName?: string
  dxfFileSize?: number
  dxfLastModified?: string
  rulFileName?: string
  rulFileSize?: number
  rulLastModified?: string
  singlePatternFileName?: string
  singlePatternFileSize?: number
  singlePatternFileLastModified?: string
  parseStatus?: TechPackPatternParseStatus
  parseStatusLabel?: string
  parseError?: string
  parsedAt?: string
  dxfEncoding?: string
  rulEncoding?: string
  rulSizeList?: string[]
  rulSampleSize?: string
  patternSoftwareName?: string
  sizeRange?: string
  selectedSizeCodes?: string[]
  imageUrl?: string
  remark?: string
  maintainerStepStatus?: TechPackPatternMaintainerStepStatus
  merchandiserInfoStatus?: Extract<TechPackPatternInfoStatus, '未填写' | '已填写'>
  patternMakerInfoStatus?: TechPackPatternInfoStatus
  isWoolted?: '是' | '否'
  linkedMaterialId?: string
  linkedMaterialName?: string
  linkedMaterialAlias?: string
  linkedMaterialSku?: string
  prjFile?: TechPackPatternManagedFile
  markerImage?: TechPackPatternManagedFile
  dxfFile?: TechPackPatternManagedFile
  rulFile?: TechPackPatternManagedFile
  bindingStrips?: TechPackPatternBindingStrip[]
  patternSignature?: string
  duplicateConfirmed?: boolean
  duplicateWarningReasons?: string[]
  // 纸样结构化信息（门幅单位：cm，排料长度单位：m，pieces 为裁片片数）
  linkedBomItemId?: string
  widthCm?: number
  markerLengthM?: number
  totalPieceCount?: number
  patternTotalPieceQty?: number
  pieceRows?: TechPackPatternPieceRow[]
  pieceInstances?: TechPackPatternPieceInstance[]
  pieceInstanceTotal?: number
  specialCraftConfiguredPieceTotal?: number
  specialCraftUnconfiguredPieceTotal?: number
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
export type TechPackWoolTaskType = 'WHOLE_GARMENT' | 'PART_PANEL'
export type TechPackWoolDownstreamTarget = '后道工厂' | '裁床待交出仓'

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
  selectedTargetObject?: TechPackSpecialCraftTargetObject
  targetObject?: 'CUT_PIECE_PART' | 'FABRIC' | 'ACCESSORY' | 'GARMENT_SEMI'
  targetObjectName?: '裁片部位' | '面料' | '辅料' | '成衣半成品'
  supportedTargetObjects?: SpecialCraftSupportedTargetObject[]
  supportedTargetObjectLabels?: SpecialCraftTargetObjectLabel[]
  woolTaskType?: TechPackWoolTaskType
  downstreamTarget?: TechPackWoolDownstreamTarget
  requiresFeiTicket?: boolean
  packagingRequired?: boolean
  materialIssueMode?: 'WAREHOUSE_DELIVERY'
  linkedBomItemIds?: string[]
  linkedPatternIds?: string[]
  visibleFactoryTypes?: SpecialCraftVisibleFactoryType[]
  triggerSource?: string
  sourceType?: 'BOM' | 'MANUAL' | 'DICT'
  triggerField?: 'printRequirement' | 'dyeRequirement' | 'shrinkRequirement' | 'washRequirement'
  isAutoGenerated?: boolean
  canRemoveAutomatically?: boolean
  hasManualOverride?: boolean
  manualNotes?: string
  manualFieldsTouched?: boolean
  requiresRemovalConfirmation?: boolean
  linkageStatus?: '已生成' | '待确认'
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
  shrinkRequirement?: '是' | '否'
  washRequirement?: '是' | '否'
  printSideMode?: '' | 'SINGLE' | 'DOUBLE'
  frontPatternDesignId?: string
  insidePatternDesignId?: string
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
  imageUrl?: string
  designSideType: TechPackPatternDesignSideType
  fileName?: string
  originalFileName?: string
  originalFileMimeType?: string
  originalFileDataUrl?: string
  previewThumbnailDataUrl?: string
  uploadedAt?: string
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
  officialVersionNo?: number
  draftSourceVersionLabel?: string
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
  selectedTargetObject?: TechPackSpecialCraftTargetObject,
): TechPackProcessEntry {
  const craft = processCraftByName.get(craftName)
  if (!craft) {
    throw new Error(`未找到可用工艺定义：${craftName}`)
  }
  const process = getProcessDefinitionByCode(craft.processCode)
  if (!process) {
    throw new Error(`未找到工序定义：${craft.processCode}`)
  }
  const supportedTargetObjectLabels = getSpecialCraftSupportedTargetObjectLabels(craft.supportedTargetObjects)
  const normalizedTargetObject = normalizeSpecialCraftTargetObjectLabel(selectedTargetObject)
  const resolvedSelectedTargetObject =
    craft.isSpecialCraft
      ? normalizedTargetObject && supportedTargetObjectLabels.includes(normalizedTargetObject)
        ? normalizedTargetObject
        : supportedTargetObjectLabels[0]
      : undefined

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
    selectedTargetObject: resolvedSelectedTargetObject,
    supportedTargetObjects: craft.isSpecialCraft ? [...craft.supportedTargetObjects] : undefined,
    supportedTargetObjectLabels: craft.isSpecialCraft ? [...supportedTargetObjectLabels] : undefined,
    visibleFactoryTypes: craft.isSpecialCraft ? [...craft.visibleFactoryTypes] : undefined,
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

function createPatternPieceSpecialCraft(craftName: string): TechPackPatternPieceSpecialCraft {
  const craft = processCraftByName.get(craftName)
  if (!craft || !craft.isActive || !craft.isSpecialCraft || craft.processCode !== 'SPECIAL_CRAFT') {
    throw new Error(`未找到可用特殊工艺定义：${craftName}`)
  }
  const process = getProcessDefinitionByCode(craft.processCode)
  if (!process) {
    throw new Error(`未找到特殊工艺工序定义：${craft.processCode}`)
  }
  const supportedTargetObjectLabels = getSpecialCraftSupportedTargetObjectLabels(craft.supportedTargetObjects)
  if (!supportedTargetObjectLabels.includes('已裁部位')) {
    throw new Error(`特殊工艺「${craftName}」不支持已裁部位`)
  }

  return {
    processCode: craft.processCode,
    processName: process.processName,
    craftCode: craft.craftCode,
    craftName: craft.craftName,
    displayName: craft.craftName,
    selectedTargetObject: '已裁部位',
    supportedTargetObjects: [...craft.supportedTargetObjects],
    supportedTargetObjectLabels,
  }
}

function buildSeedDesignSvg(label: string, fill: string, width: number, height: number, subtitle: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" rx="20" fill="#f8fafc" />
      <rect x="24" y="24" width="${width - 48}" height="${height - 72}" rx="16" fill="${fill}" />
      <text x="${width / 2}" y="${Math.round(height / 2) - 8}" font-size="26" font-family="sans-serif" text-anchor="middle" fill="#0f172a">${label}</text>
      <text x="${width / 2}" y="${Math.round(height / 2) + 28}" font-size="14" font-family="sans-serif" text-anchor="middle" fill="#475569">${subtitle}</text>
    </svg>
  `)}`
}

function buildSeedDesignAsset(label: string, fill: string, fileName: string) {
  const originalFileDataUrl = buildSeedDesignSvg(label, fill, 960, 720, fileName)
  const previewThumbnailDataUrl = buildSeedDesignSvg(label, fill, 320, 220, '缩略图预览')
  return {
    imageUrl: previewThumbnailDataUrl,
    originalFileName: fileName,
    originalFileMimeType: 'image/svg+xml',
    originalFileDataUrl,
    previewThumbnailDataUrl,
  }
}

// Mock 数据
export const techPacks: TechPack[] = []

function cloneTechPack(techPack: TechPack): TechPack {
  return JSON.parse(JSON.stringify(techPack)) as TechPack
}

function getOfficialVersionNo(versionLabel: string): number {
  const matched = versionLabel.match(/v(\d+(?:\.\d+)?)/i)
  if (!matched) return 0
  return Number.parseFloat(matched[1]) || 0
}

function buildNextOfficialVersionLabel(spuCode: string): string {
  const maxVersion = techPacks
    .filter((item) => item.spuCode === spuCode && item.status !== 'DRAFT')
    .reduce((max, item) => Math.max(max, item.officialVersionNo ?? getOfficialVersionNo(item.versionLabel)), 0)
  return `v${(Math.floor(maxVersion) + 1).toFixed(1)}`
}

export function listTechPacksBySpuCode(spuCode: string): TechPack[] {
  return techPacks.filter((tp) => tp.spuCode === spuCode)
}

export function getDraftTechPackBySpuCode(spuCode: string): TechPack | undefined {
  return techPacks.find((tp) => tp.spuCode === spuCode && tp.status === 'DRAFT')
}

export function getEnabledTechPackBySpuCode(spuCode: string): TechPack | undefined {
  return techPacks.find((tp) => tp.spuCode === spuCode && tp.status === 'ENABLED')
}

// 根据SPU获取技术包，优先进入草稿，其次读取已启用版本。
export function getTechPackBySpuCode(spuCode: string): TechPack | undefined {
  return getDraftTechPackBySpuCode(spuCode) || getEnabledTechPackBySpuCode(spuCode) || techPacks.find(tp => tp.spuCode === spuCode)
}

// 创建空白草稿技术包
export function createBetaTechPack(spuCode: string, spuName: string): TechPack {
  return {
    spuCode,
    spuName,
    status: 'DRAFT',
    versionLabel: '',
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

export const createDraftTechPack = createBetaTechPack

export function createDraftTechPackForSpu(spuCode: string, spuName?: string): {
  ok: boolean
  message: string
  techPack: TechPack
} {
  const existingDraft = getDraftTechPackBySpuCode(spuCode)
  if (existingDraft) {
    return {
      ok: false,
      message: '当前有草稿版本的技术包',
      techPack: existingDraft,
    }
  }

  const enabled = getEnabledTechPackBySpuCode(spuCode)
  const draft = enabled
    ? {
        ...cloneTechPack(enabled),
        status: 'DRAFT' as const,
        versionLabel: '',
        officialVersionNo: undefined,
        draftSourceVersionLabel: enabled.versionLabel,
        lastUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        lastUpdatedBy: 'System',
      }
    : createBetaTechPack(spuCode, spuName || spuCode)

  techPacks.push(draft)
  return {
    ok: true,
    message: '已创建草稿',
    techPack: draft,
  }
}

export function validateTechPackForPublish(techPack: TechPack): string[] {
  const pieceSpecialCraftKeys = new Set<string>()
  const errors: string[] = []

  techPack.patternFiles.forEach((patternFile) => {
    ;(patternFile.pieceRows ?? []).forEach((pieceRow) => {
      const partName = String(pieceRow.name || '').trim() || '未命名部位'
      ;(pieceRow.specialCrafts ?? []).forEach((craft) => {
        const selectedTargetObject = normalizeSpecialCraftTargetObjectLabel(craft.selectedTargetObject) || '已裁部位'
        pieceSpecialCraftKeys.add(`${craft.craftCode}:${selectedTargetObject}`)
        if (craft.craftName === '捆条') {
          if (!Number.isFinite(pieceRow.bundleLengthCm) || Number(pieceRow.bundleLengthCm) <= 0) {
            errors.push(`裁片部位「${partName}」已关联捆条，但未填写捆条长度`)
          }
          if (!Number.isFinite(pieceRow.bundleWidthCm) || Number(pieceRow.bundleWidthCm) <= 0) {
            errors.push(`裁片部位「${partName}」已关联捆条，但未填写捆条宽度`)
          }
        }
      })
    })
  })

  ;(techPack.processEntries ?? [])
    .filter((entry) => entry.entryType === 'CRAFT' && entry.isSpecialCraft && entry.craftCode)
    .forEach((entry) => {
      const craft = getProcessCraftByCode(entry.craftCode || '')
      const supportedLabels = entry.supportedTargetObjectLabels?.length
        ? entry.supportedTargetObjectLabels
        : getSpecialCraftSupportedTargetObjectLabels(craft?.supportedTargetObjects ?? [])
      const selectedTargetObject =
        normalizeSpecialCraftTargetObjectLabel(entry.selectedTargetObject)
        || (supportedLabels.length === 1 ? supportedLabels[0] : '')

      if (!selectedTargetObject) {
        errors.push(`特殊工艺「${entry.craftName || entry.processName}」未选择作用对象`)
        return
      }
      if (!supportedLabels.includes(selectedTargetObject)) {
        errors.push(`特殊工艺「${entry.craftName || entry.processName}」选择的作用对象不在字典范围内`)
        return
      }
      if (selectedTargetObject === '已裁部位' && !pieceSpecialCraftKeys.has(`${entry.craftCode}:${selectedTargetObject}`)) {
        errors.push(`特殊工艺「${entry.craftName || entry.processName}」选择了已裁部位，但纸样管理中没有关联裁片部位`)
      }
    })

  return Array.from(new Set(errors))
}

export function publishTechPackDraft(spuCode: string): {
  ok: boolean
  message: string
  techPack?: TechPack
  errors: string[]
} {
  const draft = getDraftTechPackBySpuCode(spuCode)
  if (!draft) {
    return { ok: false, message: '未找到草稿', errors: ['未找到草稿'] }
  }
  const errors = validateTechPackForPublish(draft)
  if (errors.length > 0) {
    return { ok: false, message: errors[0], techPack: draft, errors }
  }

  const nextVersionLabel = buildNextOfficialVersionLabel(spuCode)
  techPacks.forEach((item) => {
    if (item.spuCode === spuCode && item.status === 'ENABLED') {
      item.status = 'DISABLED'
    }
  })
  draft.status = 'ENABLED'
  draft.versionLabel = nextVersionLabel
  draft.officialVersionNo = getOfficialVersionNo(nextVersionLabel)
  draft.draftSourceVersionLabel = undefined
  draft.lastUpdatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19)
  return { ok: true, message: '已启用', techPack: draft, errors: [] }
}

// 获取或创建技术包（如果不存在则创建草稿版本）
export function getOrCreateTechPack(spuCode: string, spuName?: string): TechPack {
  let techPack = getTechPackBySpuCode(spuCode)
  if (!techPack) {
    // 如果没有提供spuName，使用spuCode创建草稿
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
  const supportedTargetObjects = craftDef?.isSpecialCraft
    ? [...(entry.supportedTargetObjects?.length ? entry.supportedTargetObjects : craftDef.supportedTargetObjects)]
    : undefined
  const supportedTargetObjectLabels = craftDef?.isSpecialCraft
    ? (entry.supportedTargetObjectLabels?.length
        ? [...entry.supportedTargetObjectLabels]
        : getSpecialCraftSupportedTargetObjectLabels(supportedTargetObjects ?? []))
    : undefined
  const selectedTargetObject = craftDef?.isSpecialCraft
    ? normalizeSpecialCraftTargetObjectLabel(entry.selectedTargetObject)
      || (supportedTargetObjectLabels?.length === 1 ? supportedTargetObjectLabels[0] : undefined)
    : undefined
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
    selectedTargetObject,
    supportedTargetObjects,
    supportedTargetObjectLabels,
    visibleFactoryTypes: craftDef?.isSpecialCraft ? [...(entry.visibleFactoryTypes ?? craftDef.visibleFactoryTypes)] : undefined,
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
