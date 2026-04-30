export type TechnicalVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type TechnicalDomainStatus = 'EMPTY' | 'DRAFT' | 'COMPLETE'
export type TechPackSourceTaskType = 'REVISION' | 'PLATE' | 'ARTWORK'
export type TechPackVersionChangeScope = '制版生成' | '花型写入' | '花型替换' | '改版生成'

export type TechnicalPatternMaterialType = 'WOVEN' | 'KNIT' | 'UNKNOWN'
export type TechnicalPatternFileMode = 'PAIRED_DXF_RUL' | 'SINGLE_FILE'
export type TechnicalPatternParseStatus =
  | 'NOT_PARSED'
  | 'PARSING'
  | 'PARSED'
  | 'FAILED'
  | 'NOT_REQUIRED'
export type TechnicalPatternMaintainerStepStatus =
  | '待跟单维护'
  | '待版师维护'
  | '待解析'
  | '已解析待确认'
  | '已完成'
export type TechnicalPatternInfoStatus = '未填写' | '已填写' | '待解析' | '已解析'
export type TechnicalPatternPieceSourceType = 'PARSED_PATTERN' | 'MANUAL'
export type TechnicalPatternCategory = '主体片' | '结构片' | '装饰片' | '其他'
export type TechnicalPatternDesignSideType = 'FRONT' | 'INSIDE'

export interface TechnicalPatternPieceColorAllocation {
  id: string
  colorName: string
  colorCode?: string
  skuCodes?: string[]
  pieceCount: number
}

export interface TechnicalPatternColorPieceQuantity {
  colorId: string
  colorName: string
  pieceQty: number
  enabled: boolean
  remark?: string
}

export interface TechnicalPatternPieceSpecialCraft {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  displayName: string
  selectedTargetObject?: '已裁部位' | '完整面料'
  supportedTargetObjects?: Array<'CUT_PIECE' | 'FULL_FABRIC'>
  supportedTargetObjectLabels?: Array<'已裁部位' | '完整面料'>
}

export type TechnicalPatternPieceCraftPosition = 'LEFT' | 'RIGHT' | 'BOTTOM' | 'FACE'
export type TechnicalPatternPieceCraftPositionName = '左' | '右' | '底' | '面'
export type TechnicalPatternPieceInstanceStatus = '未配置' | '已配置' | '待确认'

export interface TechnicalPatternPieceSpecialCraftAssignment {
  assignmentId: string
  craftCode: string
  craftName: string
  craftCategory?: 'AUXILIARY' | 'SPECIAL'
  craftCategoryName?: '辅助工艺' | '特种工艺'
  targetObject?: 'CUT_PIECE_PART' | 'FABRIC' | 'ACCESSORY'
  targetObjectName?: '裁片部位' | '面料' | '辅料'
  craftPosition: TechnicalPatternPieceCraftPosition
  craftPositionName: TechnicalPatternPieceCraftPositionName
  remark?: string
  createdBy?: string
  updatedAt?: string
}

export interface TechnicalPatternPieceInstance {
  pieceInstanceId: string
  sourcePieceId: string
  pieceName: string
  sizeName?: string
  colorId: string
  colorName: string
  sequenceNo: number
  displayName: string
  specialCraftAssignments: TechnicalPatternPieceSpecialCraftAssignment[]
  status: TechnicalPatternPieceInstanceStatus
}

export interface TechnicalPatternPieceRow {
  id: string
  name: string
  /** 兼容旧裁床链路。纸样页面不再直接编辑该字段，保存时由 totalPieceQty 回写。 */
  count: number
  note?: string
  isTemplate?: boolean
  partTemplateId?: string
  partTemplateName?: string
  partTemplatePreviewSvg?: string
  partTemplateShapeDescription?: string
  applicableSkuCodes?: string[]
  colorAllocations?: TechnicalPatternPieceColorAllocation[]
  specialCrafts?: TechnicalPatternPieceSpecialCraft[]
  bundleLengthCm?: number
  bundleWidthCm?: number
  sourceType?: TechnicalPatternPieceSourceType
  missingName?: boolean
  missingCount?: boolean
  sourcePartName?: string
  systemPieceName?: string
  candidatePartNames?: string[]
  sizeCode?: string
  parsedQuantity?: number
  colorPieceQuantities?: TechnicalPatternColorPieceQuantity[]
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

export interface TechnicalPatternManagedFile {
  fileName: string
  fileType: string
  fileSize: number
  uploadedAt: string
  uploadedBy: string
  previewUrl?: string
}

export interface TechnicalPatternBindingStrip {
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

export interface TechnicalPatternFile {
  id: string
  patternName?: string
  patternCategory?: TechnicalPatternCategory | string
  patternMaterialType?: TechnicalPatternMaterialType
  patternMaterialTypeLabel?: string
  patternFileMode?: TechnicalPatternFileMode
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
  parseStatus?: TechnicalPatternParseStatus
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
  maintainerStepStatus?: TechnicalPatternMaintainerStepStatus
  merchandiserInfoStatus?: Extract<TechnicalPatternInfoStatus, '未填写' | '已填写'>
  patternMakerInfoStatus?: TechnicalPatternInfoStatus
  isKnitted?: '是' | '否'
  linkedMaterialId?: string
  linkedMaterialName?: string
  linkedMaterialSku?: string
  prjFile?: TechnicalPatternManagedFile
  markerImage?: TechnicalPatternManagedFile
  dxfFile?: TechnicalPatternManagedFile
  rulFile?: TechnicalPatternManagedFile
  bindingStrips?: TechnicalPatternBindingStrip[]
  patternSignature?: string
  duplicateConfirmed?: boolean
  duplicateWarningReasons?: string[]
  linkedBomItemId?: string
  widthCm?: number
  markerLengthM?: number
  totalPieceCount?: number
  patternTotalPieceQty?: number
  pieceRows?: TechnicalPatternPieceRow[]
  pieceInstances?: TechnicalPatternPieceInstance[]
  pieceInstanceTotal?: number
  specialCraftConfiguredPieceTotal?: number
  specialCraftUnconfiguredPieceTotal?: number
}

export interface TechnicalProcessEntry {
  id: string
  entryType: 'PROCESS_BASELINE' | 'CRAFT'
  stageCode: 'PREP' | 'PROD' | 'POST'
  stageName: string
  processCode: string
  processName: string
  craftCode?: string
  craftName?: string
  assignmentGranularity: 'ORDER' | 'COLOR' | 'SKU' | 'DETAIL'
  ruleSource?: string
  detailSplitMode?: string
  detailSplitDimensions?: string[]
  defaultDocType: 'DEMAND' | 'TASK'
  taskTypeMode: 'PROCESS' | 'CRAFT'
  isSpecialCraft: boolean
  selectedTargetObject?: '已裁部位' | '完整面料'
  targetObject?: 'CUT_PIECE_PART' | 'FABRIC' | 'ACCESSORY'
  targetObjectName?: '裁片部位' | '面料' | '辅料'
  supportedTargetObjects?: Array<'CUT_PIECE' | 'FULL_FABRIC'>
  supportedTargetObjectLabels?: Array<'已裁部位' | '完整面料'>
  visibleFactoryTypes?: string[]
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
  referencePublishedSamUnit?: string
  referencePublishedSamUnitLabel?: string
  referencePublishedSamNote?: string
  difficulty?: 'LOW' | 'MEDIUM' | 'HIGH'
  remark?: string
}

export interface TechnicalSizeRow {
  id: string
  part: string
  S: number
  M: number
  L: number
  XL: number
  tolerance: number
}

export interface TechnicalBomItem {
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
  applicableSkuCodes?: string[]
  linkedPatternIds?: string[]
  usageProcessCodes?: string[]
}

export interface TechnicalColorMaterialMappingLine {
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
  sourceMode: 'AUTO' | 'MANUAL'
  note?: string
}

export interface TechnicalColorMaterialMapping {
  id: string
  spuCode: string
  colorCode: string
  colorName: string
  status: 'AUTO_CONFIRMED' | 'AUTO_DRAFT' | 'CONFIRMED' | 'MANUAL_ADJUSTED'
  generatedMode: 'AUTO' | 'MANUAL'
  confirmedBy?: string
  confirmedAt?: string
  remark?: string
  lines: TechnicalColorMaterialMappingLine[]
}

export interface TechnicalPatternDesign {
  id: string
  name: string
  imageUrl?: string
  designSideType: TechnicalPatternDesignSideType
  fileName?: string
  originalFileName?: string
  originalFileMimeType?: string
  originalFileDataUrl?: string
  previewThumbnailDataUrl?: string
  uploadedAt?: string
}

export interface TechnicalAttachment {
  id: string
  fileName: string
  fileType: string
  fileSize: string
  uploadedAt: string
  uploadedBy: string
  downloadUrl: string
}

export interface TechnicalQualityRule {
  id: string
  checkItem: string
  standardText: string
  samplingRule: string
  note: string
}

export interface TechnicalDataVersionRecord {
  technicalVersionId: string
  technicalVersionCode: string
  versionLabel: string
  versionNo: number
  styleId: string
  styleCode: string
  styleName: string
  sourceProjectId: string
  sourceProjectCode: string
  sourceProjectName: string
  sourceProjectNodeId: string
  primaryPlateTaskId: string
  primaryPlateTaskCode: string
  primaryPlateTaskVersion: string
  linkedRevisionTaskIds: string[]
  linkedPatternTaskIds: string[]
  linkedArtworkTaskIds: string[]
  createdFromTaskType: TechPackSourceTaskType
  createdFromTaskId: string
  createdFromTaskCode: string
  baseTechnicalVersionId: string
  baseTechnicalVersionCode: string
  changeScope: TechPackVersionChangeScope
  changeSummary: string
  linkedPartTemplateIds: string[]
  linkedPatternLibraryVersionIds: string[]
  linkedPatternAssetIds?: string[]
  linkedPatternAssetCodes?: string[]
  archiveCollectedFlag?: boolean
  archiveCollectedAt?: string
  versionStatus: TechnicalVersionStatus
  bomStatus: TechnicalDomainStatus
  patternStatus: TechnicalDomainStatus
  processStatus: TechnicalDomainStatus
  gradingStatus: TechnicalDomainStatus
  qualityStatus: TechnicalDomainStatus
  colorMaterialStatus: TechnicalDomainStatus
  designStatus: TechnicalDomainStatus
  attachmentStatus: TechnicalDomainStatus
  bomItemCount: number
  patternFileCount: number
  processEntryCount: number
  gradingRuleCount: number
  qualityRuleCount: number
  colorMaterialMappingCount: number
  designAssetCount: number
  attachmentCount: number
  completenessScore: number
  missingItemCodes: string[]
  missingItemNames: string[]
  publishedAt: string
  publishedBy: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  note: string
  legacySpuCode: string
  legacyVersionLabel: string
}

export interface TechnicalDataVersionContent {
  technicalVersionId: string
  patternFiles: TechnicalPatternFile[]
  patternDesc: string
  processEntries: TechnicalProcessEntry[]
  sizeTable: TechnicalSizeRow[]
  bomItems: TechnicalBomItem[]
  qualityRules: TechnicalQualityRule[]
  colorMaterialMappings: TechnicalColorMaterialMapping[]
  patternDesigns: TechnicalPatternDesign[]
  attachments: TechnicalAttachment[]
  legacyCompatibleCostPayload: Record<string, unknown>
}

export interface TechnicalDataVersionPendingItem {
  pendingId: string
  rawTechnicalCode: string
  rawStyleField: string
  rawProjectField: string
  rawVersionLabel: string
  reason: string
  discoveredAt: string
}

export interface TechnicalDataVersionStoreSnapshot {
  version: number
  records: TechnicalDataVersionRecord[]
  contents: TechnicalDataVersionContent[]
  pendingItems: TechnicalDataVersionPendingItem[]
}

export interface TechnicalDataVersionCreateResult {
  record: TechnicalDataVersionRecord
  content: TechnicalDataVersionContent
}
