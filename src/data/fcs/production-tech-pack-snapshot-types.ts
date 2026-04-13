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

export interface ProductionOrderTechPackSnapshot {
  snapshotId: string
  productionOrderId: string
  productionOrderNo: string
  styleId: string
  styleCode: string
  styleName: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  sourcePublishedAt: string
  snapshotAt: string
  snapshotBy: string
  patternDesc: string
  bomItems: TechnicalBomItem[]
  patternFiles: TechnicalPatternFile[]
  processEntries: TechnicalProcessEntry[]
  sizeTable: TechnicalSizeRow[]
  qualityRules: TechnicalQualityRule[]
  colorMaterialMappings: TechnicalColorMaterialMapping[]
  patternDesigns: TechnicalPatternDesign[]
  attachments: TechnicalAttachment[]
  linkedRevisionTaskIds: string[]
  linkedPatternTaskIds: string[]
  linkedArtworkTaskIds: string[]
  completenessScore: number
}
