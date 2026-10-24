/** Percentages use 30 / 50 / 100, never fractional 0.3 / 0.5 / 1. */
export type InspectionSourceKind = 'PRODUCTION_RETURN' | 'WAREHOUSE_STOCK' | 'PRE_PRODUCTION_SAMPLE'
export type InspectionConfigurationStatus = 'DRAFT' | 'EFFECTIVE' | 'DISABLED'
export type InspectionConfigurationKind = 'BASIC' | 'ADDITIONAL' | 'RULE'
export const INSPECTION_STAGES = {
  PRODUCTION_RETURN: 'POST_FINISHING_QC',
  WAREHOUSE_STOCK: 'WAREHOUSE_STOCK_QC',
  PRE_PRODUCTION_SAMPLE: 'PRE_PRODUCTION_SAMPLE_APPROVAL',
} as const

export interface InspectionApplicability {
  sourceKinds?: InspectionSourceKind[]
  stages?: string[]
  styleCategories?: string[]
  styleIds?: string[]
  attributes?: Array<{ key: string; value: string | number | boolean }>
}
export interface InspectionReference { id: string; name: string; kind: 'DOCUMENT' | 'PHYSICAL_SAMPLE' | 'OTHER'; value?: string; description?: string; imageUrl?: string; sourceId?: string; sourceVersion?: number; missing?: boolean }
export type InspectionItemKind = 'TEXT' | 'MEASUREMENT' | 'VISUAL' | 'FUNCTIONAL' | 'ATTRIBUTE'
export type InspectionItemMethod = 'VISUAL' | 'MEASURE' | 'FUNCTIONAL' | 'DOCUMENT'
export type InspectionSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR'
export type InspectionDisposition = 'DEFECT' | 'REWORK' | 'BOTH'
export type InspectionEvidenceRequirement = 'NONE' | 'PHOTO' | 'MEASUREMENT' | 'DOCUMENT'
export interface InspectionMeasurementSpec {
  /** Technical-pack measurement part (for example 胸围). */
  techPackPart?: string
  unit?: string
  gauge?: string
  method?: string
  /** Single tolerance used when the tech pack supplies one; null means no numeric judgement. */
  tolerance?: number | string
  /** Resolved at QC start from the order-bound technical pack, keyed by size code. */
  nominalBySize?: Record<string, number | string>
  source?: 'TECH_PACK' | 'STANDARD' | 'NONE'
}
export interface InspectionDefectCode {
  code: string
  name: string
  severity: InspectionSeverity
  disposition: InspectionDisposition
}
export interface InspectionContext {
  sourceKind: InspectionSourceKind
  stage?: string
  objectType?: string
  styleId?: string
  styleCode?: string
  styleCategory?: string
  styleCategoryAliases?: string[]
  attributes?: Record<string, string | number | boolean>
  references?: InspectionReference[]
}
export interface InspectionStandardItem {
  id: string
  dimension: string
  name: string
  content: string
  criterion: string
  unit?: string
  references: InspectionReference[]
  applicability?: InspectionApplicability
  kind?: InspectionItemKind
  method?: InspectionItemMethod
  measurement?: InspectionMeasurementSpec
  defectCodes?: InspectionDefectCode[]
  severity?: InspectionSeverity
  disposition?: InspectionDisposition
  evidenceRequirement?: InspectionEvidenceRequirement
}
export type InspectionOverrideField = 'dimension' | 'name' | 'content' | 'criterion' | 'unit' | 'references' | 'applicability' | 'kind' | 'method' | 'measurement' | 'defectCodes' | 'severity' | 'disposition' | 'evidenceRequirement'
export interface InspectionItemOverride {
  targetItemId: string
  fields: InspectionOverrideField[]
  values: Partial<Omit<InspectionStandardItem, 'id'>>
  applicability?: InspectionApplicability
}
export interface InspectionConfigurationBase {
  id: string
  familyId: string
  version: number
  name: string
  status: InspectionConfigurationStatus
  objectType: string
  applicability: InspectionApplicability
  createdAt: string
  updatedAt: string
  effectiveAt?: string
  disabledAt?: string
}
export interface InspectionStandard extends InspectionConfigurationBase { kind: 'BASIC'; items: InspectionStandardItem[] }
export interface AdditionalInspectionStandard extends InspectionConfigurationBase {
  kind: 'ADDITIONAL'
  level: 'STYLE_CATEGORY' | 'STYLE'
  items: InspectionStandardItem[]
  overrides: InspectionItemOverride[]
}
export interface InitialFullInspectionConditions {
  basicStyle: boolean
  highDifficulty: boolean
  outsideFabricWhitelist: boolean
  firstFactoryTasks: boolean
  firstTaskCount: number
  fabricSpuWhitelist: string[]
}
export interface InspectionRuleConfig extends InspectionConfigurationBase {
  kind: 'RULE'
  /** The only supported quantity basis in this release. */
  quantityBasis: 'BATCH'
  defaultPercent: number
  minQuantity: number
  percentSteps: number[]
  roundThresholds: Array<{ roundNumber: number; unqualifiedQuantity: number }>
  initialFullInspection: InitialFullInspectionConditions | null
}
export type InspectionConfiguration = InspectionStandard | AdditionalInspectionStandard | InspectionRuleConfig
export interface ResolvedInspectionItem extends InspectionStandardItem {
  basicItemId?: string
  sourceStandardId: string
  sourceStandardVersion: number
  overriddenBy: Array<{ standardId: string; version: number; fields: InspectionOverrideField[] }>
}
export interface ResolvedInspectionStandard {
  basicStandard: { id: string; version: number; name: string }
  additionalStandards: Array<{ id: string; version: number; name: string; level: AdditionalInspectionStandard['level'] }>
  items: ResolvedInspectionItem[]
}
export interface InspectionRuleSnapshot {
  id: string
  version: number
  quantityBasis: 'BATCH'
  defaultPercent: number
  minQuantity: number
  percentSteps: number[]
  roundThresholds: InspectionRuleConfig['roundThresholds']
  initialFullInspection: InitialFullInspectionConditions | null
}
export interface InspectionSnapshot extends ResolvedInspectionStandard {
  id: string
  selectedAt: string
  configRevision: number
  context: InspectionContext
  references: InspectionReference[]
  ruleSnapshot: InspectionRuleSnapshot | null
  skuSnapshots?: Array<{ skuId: string; snapshot: InspectionSnapshot }>
  /** 2 = typed item/measurement schema; absent means legacy text-only snapshot. */
  snapshotSchemaVersion?: number
  techPackVersionId?: string
}
export interface InspectionIssue { itemId: string; note?: string; evidenceFileIds?: string[] }
export interface InspectionItemObservation {
  itemId: string
  skuId?: string
  skuCode?: string
  sizeName?: string
  result: 'PASS' | 'FAIL' | 'NOT_APPLICABLE'
  measuredValue?: number | string
  measurementUnit?: string
  defectCode?: string
  note?: string
  evidenceFileIds?: string[]
}
export interface InspectionRoundResult {
  /** Original round facts; absent for history that never recorded them. */
  percent?: number
  target?: number
  id: string
  roundNumber: number
  passedQty: number
  defectQty: number
  returnedQty: number
  issues: InspectionIssue[]
  observations?: InspectionItemObservation[]
  submittedAt: string
}
export interface InspectionAuditView {
  id: string
  roundNumber: number
  threshold: number
  unqualifiedQty: number
  status: 'PENDING' | 'UPGRADED'
  fromPercent: number
  toPercent?: number
  decidedAt?: string
  note?: string
}
export interface QualityInspectionRecordView {
  id: string
  sourceKind: InspectionSourceKind
  sourceId: string
  displayNo: string
  sourceHref: string
  styleId?: string
  styleCode: string
  styleName: string
  imageUrl?: string
  factoryName?: string
  warehouseName?: string
  productionOrderNo?: string
  status: string
  openedAt?: string
  completedAt?: string
  quantity?: number
  inspectedQty?: number
  passedQty?: number
  defectQty?: number
  returnedQty?: number
  uninspectedReleaseQty?: number
  normalReleaseQty?: number
  sentQty?: number
  receivedQty?: number
  /** Read-only original application while no QC exists; never a fabricated QC. */
  inventoryApplicationOnly?: boolean
  returnReceivedQty?: number
  putawayQty?: number
  defectReceivedQty?: number
  defectPutawayQty?: number
  gotoReceivedQty?: number
  destinationSummary?: string
  sampleResult?: 'NO_ISSUE' | 'HAS_ISSUE'
  dueAt?: string
  timeZone?: string
  snapshot?: InspectionSnapshot
  rounds?: InspectionRoundResult[]
  audits?: InspectionAuditView[]
  issues: InspectionIssue[]
  /** Names from this record's frozen standard, projected without copying the full tree. */
  issueNames?: Record<string, string>
  basisClarifications?: Array<{itemId:string;conflictDescription:string;adoptedBasis:string;clarificationNote:string;at:string;by:string}>
  independentChecks?: Array<{id:string;originalRecordId:string;objectDescription:string;scopeDescription:string;itemIds:string[];reason:string;result:string;at:string;by:{actorName:string}}>
}
