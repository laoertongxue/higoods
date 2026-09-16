import type {
  TechnicalBomItem,
  TechnicalColorMaterialMapping,
  TechnicalPatternDesign,
  TechnicalPatternFileMode,
  TechnicalPatternParseStatus,
  TechnicalPatternFile,
  TechnicalProcessEntry,
  TechnicalSizeRow,
  TechnicalGarmentDifficultyGrade,
} from '../pcs-technical-data-version-types.ts'

export type PatternMaterialType = 'WOOL' | 'WOVEN' | 'UNKNOWN'

export const patternMaterialTypeLabels: Record<PatternMaterialType, string> = {
  WOOL: '毛织',
  WOVEN: '布料',
  UNKNOWN: '暂无数据',
}

export const patternMaterialFileTypeLabels: Record<PatternMaterialType, string> = {
  WOOL: '毛织纸样',
  WOVEN: '布料纸样',
  UNKNOWN: '暂无数据',
}

export interface TechPackPatternFileSnapshot extends TechnicalPatternFile {
  patternFileId: string
  patternFileName: string
  patternVersion: string
  patternMaterialType: PatternMaterialType
  patternMaterialTypeLabel: string
  patternFileMode: TechnicalPatternFileMode
  dxfFileName?: string
  rulFileName?: string
  singlePatternFileName?: string
  patternSoftwareName?: string
  sizeRange?: string
  rulSizeList: string[]
  rulSampleSize?: string
  parseStatus: TechnicalPatternParseStatus
  parsedAt?: string
  imageUrl?: string
  remark?: string
}

export interface TechPackBomItemSnapshot extends TechnicalBomItem {
  materialAlias?: string
  materialImageUrl?: string
}

export interface TechPackSizeMeasurementSnapshot {
  sizeCode: string
  measurementPart: string
  measurementValue: number | string
  measurementUnit: string
  tolerance?: number | string
  remark?: string
}

export interface TechPackCutPiecePartSnapshot {
  partCode: string
  partNameCn: string
  partNameId?: string
  partNameIdn?: string
  pieceCountPerGarment: number
  materialSku: string
  materialName?: string
  fabricColor?: string
  applicableColorList: string[]
  applicableSizeList: string[]
  specialCrafts?: Array<{
    processCode: string
    processName: string
    craftCode: string
    craftName: string
    displayName: string
    selectedTargetObject?: '已裁部位' | '完整面料' | '成衣' | '捆条' | '辅料'
    supportedTargetObjects?: Array<'CUT_PIECE' | 'FULL_FABRIC' | 'SEMI_FINISHED_GARMENT' | 'BINDING_STRIP' | 'ACCESSORY'>
    supportedTargetObjectLabels?: Array<'已裁部位' | '完整面料' | '成衣' | '捆条' | '辅料'>
  }>
  bundleLengthCm?: number
  bundleWidthCm?: number
  manualConfirmRequired: boolean
  remark?: string
}

export interface TechPackImageSnapshot {
  productImages: string[]
  styleImages: string[]
  sampleImages: string[]
  materialImages: string[]
  accessoryImages: string[]
  patternImages: string[]
  markerImages: string[]
  artworkImages: string[]
}

/** Explicit source fields for the online production confirmation layout.
 * These values are optional: an absent source is printed as 未维护 / 未发生.
 * Original Indonesian labels are retained verbatim rather than guessed translations.
 */
export interface ProductionConfirmationOnlineFacts {
  sourceRef: string
  purchaseOrderNos?: string[]
  retailTagPrice?: { amount: number; currency: string; sourceRef: string }
  orderDate?: { value: string; sourceRef: string }
  milestones?: Array<{
    key: 'cuttingCompleted' | 'factoryArrived' | 'firstDelivery' | 'productionCompleted'
    actualAt?: string
    plannedAt?: string
    sourceRef: string
  }>
  fabricRolls?: Array<{ rollId: string; sourceRef: string }>
  originalLabelFields?: Array<{
    label: 'Apakah itu undang-undang dasar' | 'Yang sama'
    value: string
    sourceRef: string
  }>
  colorImages?: Array<{ color: string; skuCodes?: string[]; imageUrl: string; sourceRef: string }>
  materialInfo?: Array<{ materialSku: string; warehouseLabel?: string; preparedLabel?: string }>
  bindingStrips?: Array<{ color: string; length: number; unit: string }>
}

export type TechnicalColorMaterialMappingOrigin = 'TECH_PACK' | 'DEMAND_FALLBACK'

export interface ProductionTechPackColorMaterialMapping extends TechnicalColorMaterialMapping {
  mappingOrigin: TechnicalColorMaterialMappingOrigin
}

export interface ProductionOrderTechPackSnapshot {
  snapshotId: string
  productionOrderId: string
  productionOrderNo: string
  styleId: string
  styleCode: string
  styleName: string
  status: 'RELEASED'
  versionLabel: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  garmentDifficultyGrade?: TechnicalGarmentDifficultyGrade
  sourcePublishedAt: string
  snapshotAt: string
  snapshotBy: string
  patternDesc: string
  internalStyleCode?: string
  bomItems: TechPackBomItemSnapshot[]
  patternFiles: TechPackPatternFileSnapshot[]
  processEntries: TechnicalProcessEntry[]
  sizeTable: TechnicalSizeRow[]
  sizeMeasurements: TechPackSizeMeasurementSnapshot[]
  colorMaterialMappings: ProductionTechPackColorMaterialMapping[]
  cutPieceParts: TechPackCutPiecePartSnapshot[]
  imageSnapshot: TechPackImageSnapshot
  onlineConfirmationFacts?: ProductionConfirmationOnlineFacts
  patternDesigns: TechnicalPatternDesign[]
  linkedDesignRevisionTaskIds: string[]
  linkedPatternTaskIds: string[]
  linkedArtworkTaskIds: string[]
  completenessScore: number
}
