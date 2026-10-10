export type MaterialArchiveKind = 'fabric' | 'accessory' | 'yarn' | 'consumable' | 'parts'
export type MaterialArchiveStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'NOT_ENABLED'
export type MaterialApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED'
export type MaterialProcessType = 'DYEING' | 'PRINTING' | 'EMBROIDERY' | 'HEAT_TRANSFER'
export interface MaterialNamedDimension { name: string; value: number; unit: string }
export interface MaterialDictionaryReference { id: string; name: string; code: string; dictionaryId?: string; dictionaryVersion?: number }
export interface MaterialEquipmentCompatibility {
  equipmentTypeId: string; equipmentTypeName: string
  equipmentModelId?: string; equipmentModelName?: string
}
export type MaterialSpecValues = Record<string, string | number | string[] | MaterialNamedDimension[] | null>
export type MaterialStage = 'BASE' | MaterialProcessType

export interface MaterialUnitConversion {
  fromUnit: string
  toUnit: string
  factor: number
}

export interface MaterialArchiveRecord {
  approvalStatus?: MaterialApprovalStatus
  templateId?: string
  templateVersion?: number
  categoryAttributes?: MaterialSpecValues
  categoryAttributeReferences?: Record<string, MaterialDictionaryReference[]>
  subcategoryId?: string
  materialNameTranslations?: Record<string, string>
  equipmentCompatibility?: string[]
  equipmentCompatibilityDetails?: MaterialEquipmentCompatibility[]
  compositionItems?: Array<{ component: string; componentId?: string; percentage: number }>
  legacyCodes?: string[]
  widthValueCm?: number | null
  gramWeightGsm?: number | null
  materialId: string
  kind: MaterialArchiveKind
  materialCode: string
  materialName: string
  materialNameEn: string
  categoryName: string
  specSummary: string
  composition: string
  processTags: string[]
  widthText: string
  gramWeightText: string
  pricingUnit: string
  mainUnit: string
  auxiliaryUnits: string[]
  unitConversions?: MaterialUnitConversion[]
  mainImageUrl: string
  galleryImageUrls: string[]
  status: MaterialArchiveStatus
  skuCount: number
  usedStyleCount: number
  usedTechPackCount: number
  barcodeTemplateCode: string
  remark: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface MaterialSkuRecord {
  approvalStatus?: MaterialApprovalStatus
  stage?: MaterialStage
  mainUnit?: string
  mainUnitUsed?: boolean
  mainUnitVersion?: number
  colorCode?: string
  colorId?: string
  pantoneId?: string
  pantoneSystem?: string
  baseSpecSegment?: string
  identityValues?: MaterialSpecValues
  identityReferences?: Record<string, MaterialDictionaryReference[]>
  effectiveSpecValues?: MaterialSpecValues
  inputSkuId?: string
  processDefinitionId?: string
  barcodeAliases?: string[]
  materialAssetIds?: string[]
  currentCostVersionId?: string
  netWeightPerMainKg?: number | null
  codeRuleVersionId?: string
  materialSkuId: string
  materialId: string
  materialCode: string
  materialSkuCode: string
  materialName: string
  colorName: string
  /** TMF 织带／绳子半成品的潘通或色号；长度和端头不属于 SKU 身份。 */
  pantoneCode?: string
  /** TMF 织带／绳子半成品的花型编号；无印花时为空。 */
  patternCode?: string
  /** 设计改款目标 SKU 的已确认加工链；不从编码推断工艺。 */
  designRevisionProcesses?: Array<'DYEING' | 'PRINTING'>
  /** 首道仓库发料 SKU。 */
  designRevisionRawSkuId?: string
  /** 同时染色、印花时染后中间品 SKU。 */
  designRevisionDyedSkuId?: string
  /** 与该目标 SKU 对应的正式花型图片。 */
  patternImageUrl?: string
  specName: string
  specDescription?: string
  sizeName: string
  skuImageUrl: string
  costPrice: number
  freightCost: number
  pricingUnit: string
  unitConversions?: MaterialUnitConversion[]
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
  barcode: string
  status: MaterialArchiveStatus
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface MaterialUsageRecord {
  usageId: string
  materialId: string
  styleId: string
  styleCode: string
  styleName: string
  technicalVersionId: string
  technicalVersionLabel: string
  consumptionText: string
  updatedAt: string
}

export interface MaterialSkuDraftInput {
  materialName?: string
  netWeightPerMainKg?: number | null
  mainUnit?: string
  pricingUnit?: string
  colorCode?: string
  colorId?: string
  pantoneId?: string
  pantoneSystem?: string
  identityValues?: MaterialSpecValues
  identityReferences?: Record<string, MaterialDictionaryReference[]>
  effectiveSpecValues?: MaterialSpecValues
  barcodeAliases?: string[]
  materialAssetIds?: string[]
  purchaseStandardCny?: number | null
  transportStandardCny?: number | null
  mainUnitUsed?: boolean
  colorName: string
  pantoneCode?: string
  patternCode?: string
  specName: string
  specDescription?: string
  sizeName: string
  skuImageUrl: string
  costPrice: number
  freightCost: number
  weightKg: number
  lengthCm: number
  widthCm: number
  heightCm: number
  barcode: string
}

export interface MaterialLogRecord {
  logId: string
  materialId: string
  operatorName: string
  title: string
  detail: string
  createdAt: string
}

export interface MaterialArchiveStoreSnapshot {
  version: number
  records: MaterialArchiveRecord[]
  skuRecords: MaterialSkuRecord[]
  usageRecords: MaterialUsageRecord[]
  logRecords: MaterialLogRecord[]
  processDefinitions?: MaterialProcessDefinition[]
  unitRelations?: MaterialUnitRelation[]
  packages?: MaterialPackageSpec[]
  costVersions?: MaterialStandardCostVersion[]
  assets?: MaterialAsset[]
}

export interface MaterialProcessDefinition {
  processDefinitionId: string
  inputSkuId: string
  outputSkuId: string
  processType: MaterialProcessType
  objectType: 'MATERIAL'
  processVersionId: string
  patternId?: string
  patternCode?: string
  patternVersionId?: string
  backPatternId?: string
  backPatternCode?: string
  backPatternVersionId?: string
  printSide?: 'A' | 'AB'
  penetration?: boolean
  pantoneSystem?: string
  pantoneCode?: string
  pantoneId?: string
  colorId?: string
  colorCode?: string
  colorName?: string
  patternImageUrl?: string
  executionAssetIds: string[]
  documentHistory?: Array<{ processVersionId: string; executionAssetIds: string[]; replacedAt: string }>
  unitBridgeVersionId?: string
  codeRuleVersionId: string
  deliveryRevisionSegment?: string
  createdAt: string
}
export interface MaterialProcessDraft {
  inputSkuId: string
  processType: MaterialProcessType
  objectType?: 'MATERIAL' | 'CUT_PIECE' | 'WOOL_PANEL' | 'GARMENT'
  colorCode?: string
  colorName?: string
  pantoneSystem?: string
  pantoneCode?: string
  patternId?: string
  patternCode?: string
  patternVersionId?: string
  patternImageUrl?: string
  backPatternId?: string
  backPatternCode?: string
  backPatternVersionId?: string
  printSide?: 'A' | 'AB'
  penetration?: boolean
  executionAssetIds?: string[]
  processVersionId?: string
  deliveryRevisionSegment?: string
  skuImageUrl: string
  mainUnit?: string
  pricingUnit?: string
  unitBridgeVersionId?: string
  effectiveSpecValues?: MaterialSpecValues
  processStandardCny?: number | null
}
export interface MaterialUnitRelation {
  relationId: string
  materialSkuId: string
  auxUnitId: string
  mainQtyPerAux: number
  basisType: 'FIXED' | 'SPECIFICATION' | 'PACKAGE'
  basisReference: string
  packageSpecId?: string
  uses: Array<'PURCHASE' | 'PRICING' | 'ISSUE'>
  isDefaultForUse: Array<'PURCHASE' | 'PRICING' | 'ISSUE'>
  version: number
  status: 'ACTIVE' | 'INACTIVE'
  changeReason: string
  createdAt: string
}
export interface MaterialPackageSpec {
  packageSpecId: string
  ownerSkuId: string
  packageTypeId: string
  contentQty: number
  contentUnitId: string
  grossWeightKg: number | null
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  volumeM3: number | null
  volumeSource: 'DIMENSIONS' | 'CONFIRMED' | 'UNKNOWN'
  measurementBasis: string
  version: number
  status: 'ACTIVE' | 'INACTIVE'
}
export interface MaterialStandardCostVersion {
  costVersionId: string
  materialSkuId: string
  purchaseStandardCny: number | null
  transportStandardCny: number | null
  purchaseIncludesTransport: boolean
  processStandardCny: number | null
  pricingUnit: string
  pricingUnitRelationId?: string
  sourceMoney?: { amount: string; currency: string; unit: string; cnyPerSourceCurrency: string; normalizationBasis: string }
  taxIncluded: true
  effectiveAt: string
  changeReason: string
  operatorName: string
}
export interface MaterialCostLine {
  materialSkuId: string
  costVersionId: string
  title: string
  amountCny: number | null
  pricingUnit: string
  kind: 'PURCHASE' | 'TRANSPORT' | 'PROCESS'
}
export interface MaterialCostSnapshot {
  materialSkuId: string
  costVersionId: string
  pricingUnit: string
  totalStandardCny: number | null
  completeness: string[]
  lines: MaterialCostLine[]
  adoptedVersionIds: string[]
  evaluatedAt: string
}
export interface MaterialAsset {
  assetId: string
  materialId: string
  materialSkuId?: string
  role: 'IDENTIFICATION' | 'INPUT' | 'PATTERN' | 'COLOR_SAMPLE' | 'PRINT_FILE' | 'EMBROIDERY_FILE' | 'HEAT_TRANSFER_FILE' | 'SPECIFICATION'
  name: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  sortOrder?: number
  url: string
  fileId?: string
  version: number
  createdAt: string
}
