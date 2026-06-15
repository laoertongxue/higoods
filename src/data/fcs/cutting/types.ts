export type CuttingUrgencyLevel = 'AA' | 'A' | 'B' | 'C' | 'D'

export type CuttingMaterialType = 'PRINT' | 'DYE' | 'SOLID' | 'LINING'

export type CuttingReviewStatus = 'NOT_REQUIRED' | 'PENDING' | 'PARTIAL' | 'APPROVED'
export type CuttingConfigStatus = 'NOT_CONFIGURED' | 'PARTIAL' | 'CONFIGURED'
export type CuttingReceiveStatus = 'NOT_RECEIVED' | 'PARTIAL' | 'RECEIVED'
export type CuttingPrintSlipStatus = 'NOT_PRINTED' | 'PRINTED'
export type CuttingQrStatus = 'NOT_GENERATED' | 'GENERATED'
export type CuttingMarkerPlanOccupancyStatus = 'AVAILABLE' | 'IN_MARKER_PLAN'

export type CuttingRiskFlag =
  | 'PENDING_REVIEW'
  | 'PARTIAL_CONFIG'
  | 'RECEIVE_DIFF'
  | 'INBOUND_PENDING'
  | 'SHIP_URGENT'

export interface CuttingSkuRequirementLine {
  skuCode: string
  color: string
  size: string
  plannedQty: number
}

export interface CuttingCutOrderSkuScopeLine {
  skuCode: string
  color: string
  size: string
  plannedQty: number
}

export interface CuttingPieceProgressLine {
  skuCode: string
  color: string
  size: string
  partCode?: string
  partName: string
  actualCutQty: number
  inboundQty: number
  feiPrintedQty?: number
  latestUpdatedAt?: string
  latestOperatorName?: string
}

export interface CuttingMaterialIdentity {
  materialSku: string
  materialName: string
  materialColor: string
  materialAlias: string
  materialImageUrl: string
  materialUnit: string
}

export interface CuttingPatternIdentity {
  patternFileId: string
  patternFileName: string
  patternVersion: string
  patternKind: string
  effectiveWidthValue: number
  effectiveWidthUnit: string
  piecePartCodes: string[]
  piecePartNames: string[]
}

export interface CuttingMaterialLine {
  cutOrderId?: string
  cutOrderNo?: string
  cutPieceOrderNo: string
  markerPlanId?: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  materialAlias?: string
  materialImageUrl?: string
  color?: string
  materialCategory?: string
  materialIdentity?: CuttingMaterialIdentity
  patternIdentity?: CuttingPatternIdentity
  reviewStatus: CuttingReviewStatus
  configStatus: CuttingConfigStatus
  receiveStatus: CuttingReceiveStatus
  configuredRollCount: number
  configuredLength: number
  receivedRollCount: number
  receivedLength: number
  printSlipStatus: CuttingPrintSlipStatus
  qrStatus: CuttingQrStatus
  markerPlanOccupancyStatus?: CuttingMarkerPlanOccupancyStatus
  markerPlanNo?: string
  skuScopeLines?: CuttingCutOrderSkuScopeLine[]
  pieceProgressLines?: CuttingPieceProgressLine[]
  issueFlags: CuttingRiskFlag[]
  latestActionText: string
}

export interface CuttingOrderProgressRecord {
  id: string
  productionOrderId: string
  productionOrderNo: string
  actualOrderDate: string
  purchaseDate: string
  orderQty: number
  plannedShipDate: string
  spuCode: string
  techPackSpuCode?: string
  styleCode: string
  styleName: string
  sellingPrice?: number
  urgencyLevel: CuttingUrgencyLevel
  cuttingTaskNo: string
  assignedFactoryName: string
  cuttingStage: string
  demandCreatedAt: string
  productionOrderCreatedAt: string
  cuttingTaskAssignedAt: string
  markerPlanCreatedAt: string
  spreadingStartedAt: string
  completedAt: string
  spuImageUrl: string
  closeReasonCode?: 'MATERIAL_NO_MORE_ARRIVAL' | 'BUSINESS_STOP_RECUT' | 'FORCED_CLOSE' | 'STYLE_CANCELLED' | 'DEMAND_CANCELLED' | 'MATERIAL_REPLACED_UNUSED' | 'OTHER'
  closeReasonText?: string
  closedAt?: string
  closedBy?: string
  closeReason?: string
  ledgerSnapshotBeforeClose?: {
    requiredMaterialQty: number
    transferWarehouseAllocatedQty: number
    cuttingClaimedQty: number
    spreadingConsumedQty: number
    availableQty: number
    unit: string
  }
  riskFlags: CuttingRiskFlag[]
  lastPickupScanAt: string
  lastFieldUpdateAt: string
  lastOperatorName: string
  hasSpreadingRecord: boolean
  hasInboundRecord: boolean
  skuRequirementLines?: CuttingSkuRequirementLine[]
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
