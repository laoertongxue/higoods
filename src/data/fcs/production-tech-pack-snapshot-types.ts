import type {
  TechnicalAttachment,
  TechnicalBomItem,
  TechnicalColorMaterialMapping,
  TechnicalPatternDesign,
  TechnicalPatternFile,
  TechnicalProcessEntry,
  TechnicalQualityRule,
  TechnicalSizeRow,
} from '../pcs-technical-data-version-types.ts'

export type PatternMaterialType = 'KNIT' | 'WOVEN' | 'UNKNOWN'

export const patternMaterialTypeLabels: Record<PatternMaterialType, string> = {
  KNIT: '针织',
  WOVEN: '布料',
  UNKNOWN: '暂无数据',
}

export interface TechPackPatternFileSnapshot extends TechnicalPatternFile {
  patternFileId: string
  patternFileName: string
  patternVersion: string
  patternMaterialType: PatternMaterialType
  patternMaterialTypeLabel: string
  patternSoftwareName?: string
  sizeRange?: string
  imageUrl?: string
  remark?: string
}

export interface TechPackBomItemSnapshot extends TechnicalBomItem {
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
  sourcePublishedAt: string
  snapshotAt: string
  snapshotBy: string
  patternDesc: string
  bomItems: TechPackBomItemSnapshot[]
  patternFiles: TechPackPatternFileSnapshot[]
  processEntries: TechnicalProcessEntry[]
  sizeTable: TechnicalSizeRow[]
  sizeMeasurements: TechPackSizeMeasurementSnapshot[]
  qualityRules: TechnicalQualityRule[]
  colorMaterialMappings: TechnicalColorMaterialMapping[]
  cutPieceParts: TechPackCutPiecePartSnapshot[]
  imageSnapshot: TechPackImageSnapshot
  patternDesigns: TechnicalPatternDesign[]
  attachments: TechnicalAttachment[]
  linkedRevisionTaskIds: string[]
  linkedPatternTaskIds: string[]
  linkedArtworkTaskIds: string[]
  completenessScore: number
}
