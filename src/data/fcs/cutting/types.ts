export type CuttingUrgencyLevel = 'AA' | 'A' | 'B' | 'C' | 'D'

export type CuttingMaterialType = 'PRINT' | 'DYE' | 'SOLID' | 'LINING'

export type CuttingReviewStatus = 'NOT_REQUIRED' | 'PENDING' | 'PARTIAL' | 'APPROVED'
export type CuttingConfigStatus = 'NOT_CONFIGURED' | 'PARTIAL' | 'CONFIGURED'
export type CuttingReceiveStatus = 'NOT_RECEIVED' | 'PARTIAL' | 'RECEIVED'
export type CuttingPrintSlipStatus = 'NOT_PRINTED' | 'PRINTED'
export type CuttingQrStatus = 'NOT_GENERATED' | 'GENERATED'

export type CuttingRiskFlag =
  | 'PENDING_REVIEW'
  | 'PARTIAL_CONFIG'
  | 'RECEIVE_DIFF'
  | 'REPLENISH_PENDING'
  | 'INBOUND_PENDING'
  | 'SHIP_URGENT'

export interface CuttingMaterialLine {
  cutPieceOrderNo: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  reviewStatus: CuttingReviewStatus
  configStatus: CuttingConfigStatus
  receiveStatus: CuttingReceiveStatus
  configuredRollCount: number
  configuredLength: number
  receivedRollCount: number
  receivedLength: number
  printSlipStatus: CuttingPrintSlipStatus
  qrStatus: CuttingQrStatus
  issueFlags: CuttingRiskFlag[]
  latestActionText: string
}

export interface CuttingOrderProgressRecord {
  id: string
  productionOrderNo: string
  purchaseDate: string
  orderQty: number
  plannedShipDate: string
  urgencyLevel: CuttingUrgencyLevel
  cuttingTaskNo: string
  assignedFactoryName: string
  cuttingStage: string
  riskFlags: CuttingRiskFlag[]
  lastPickupScanAt: string
  lastFieldUpdateAt: string
  lastOperatorName: string
  hasSpreadingRecord: boolean
  hasInboundRecord: boolean
  materialLines: CuttingMaterialLine[]
}

export interface CuttingOrderProgressFilters {
  keyword: string
  urgencyLevel: 'ALL' | CuttingUrgencyLevel
  auditStatus: 'ALL' | 'PENDING' | 'PARTIAL' | 'APPROVED'
  configStatus: 'ALL' | CuttingConfigStatus
  receiveStatus: 'ALL' | CuttingReceiveStatus
  riskFilter: 'ALL' | 'RISK_ONLY'
}
