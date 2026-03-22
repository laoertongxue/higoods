export type CuttingExceptionType =
  | 'RECEIVE_DISCREPANCY'
  | 'MISSING_EVIDENCE'
  | 'MARKER_NOT_MAINTAINED'
  | 'SPREADING_DATA_INSUFFICIENT'
  | 'REPLENISHMENT_PENDING'
  | 'INBOUND_PENDING'
  | 'ZONE_UNASSIGNED'
  | 'SAMPLE_OVERDUE'
  | 'HANDOVER_PENDING'

export type CuttingExceptionScenarioType = 'CUTTING'

export type CuttingExceptionSourceLayer = 'PLATFORM' | 'PCS' | 'FACTORY_APP'

export type CuttingExceptionSourcePage =
  | 'ORDER_PROGRESS'
  | 'MATERIAL_PREP'
  | 'CUT_PIECE_ORDER'
  | 'REPLENISHMENT'
  | 'WAREHOUSE'
  | 'PDA_PICKUP'
  | 'PDA_SPREADING'
  | 'PDA_INBOUND'
  | 'PDA_HANDOVER'
  | 'PDA_REPLENISHMENT_FEEDBACK'

export type CuttingExceptionRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export type CuttingExceptionStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CONFIRM' | 'CLOSED'

export type CuttingExceptionOwnerRole = 'PLATFORM' | 'CUTTING_FACTORY_OPS' | 'FIELD_EXECUTION'

export interface CuttingException {
  exceptionNo: string
  exceptionType: CuttingExceptionType
  exceptionTypeLabel: string
  scenarioType: CuttingExceptionScenarioType
  productionOrderNo: string
  cuttingTaskNo: string
  cutPieceOrderNo: string
  materialSku: string
  sourceLayer: CuttingExceptionSourceLayer
  sourcePage: CuttingExceptionSourcePage
  riskLevel: CuttingExceptionRiskLevel
  status: CuttingExceptionStatus
  ownerRole: CuttingExceptionOwnerRole
  ownerName: string
  assignedFactoryName: string
  triggerSummary: string
  evidenceSummary: string
  latestActionSummary: string
  latestActionAt: string
  latestActionBy: string
  suggestedAction: string
  suggestedRoute: string
  closureCondition: string
  closedAt: string
  closedBy: string
  closeNote: string
  pickupSlipNo: string
  latestPrintVersionNo: string
  qrCodeValue: string
  latestScanResultLabel: string
  hasPhotoEvidence: boolean
  needsRecheck: boolean
  pickupSummaryText: string
  executionSummaryText: string
  replenishmentSummaryText: string
  warehouseSummaryText: string
  sampleSummaryText: string
  evidenceCount: number
  triggerConditionText: string
  closureConditionText: string
}

export interface CuttingExceptionFollowupSummary {
  openHighRiskCount: number
  repeatedRecheckCount: number
  photoEvidenceCount: number
  longOpenCount: number
  settlementAttentionCount: number
  factoryScoreAttentionCount: number
}
