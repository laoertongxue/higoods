export type CuttingUrgencyLevel = 'AA' | 'A' | 'B' | 'C' | 'D'

export type CuttingMaterialType = 'PRINT' | 'DYE' | 'SOLID' | 'LINING'

/**
 * @deprecated legacy field kept only for backward compatibility; no longer used by cutting domain UI,
 * readiness logic, cuttable logic, or QR enablement rules.
 */
export type CuttingReviewStatus = 'NOT_REQUIRED' | 'PENDING' | 'PARTIAL' | 'APPROVED'
export type CuttingConfigStatus = 'NOT_CONFIGURED' | 'PARTIAL' | 'CONFIGURED'
export type CuttingReceiveStatus = 'NOT_RECEIVED' | 'PARTIAL' | 'RECEIVED'
export type CuttingPrintSlipStatus = 'NOT_PRINTED' | 'PRINTED'
export type CuttingQrStatus = 'NOT_GENERATED' | 'GENERATED'
export type CuttingBatchOccupancyStatus = 'AVAILABLE' | 'IN_BATCH'

export type CuttingRiskFlag =
  /**
   * @deprecated legacy risk kept only for backward compatibility; no longer used by cutting domain UI,
   * readiness logic, cuttable logic, or QR enablement rules.
   */
  | 'PENDING_REVIEW'
  | 'PARTIAL_CONFIG'
  | 'RECEIVE_DIFF'
  | 'REPLENISH_PENDING'
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

export interface CuttingMaterialLine {
  originalCutOrderId?: string
  originalCutOrderNo?: string
  cutPieceOrderNo: string
  mergeBatchId?: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  color?: string
  materialCategory?: string
  /**
   * @deprecated legacy field kept only for backward compatibility; no longer used by cutting domain UI,
   * readiness logic, cuttable logic, or QR enablement rules.
   */
  reviewStatus: CuttingReviewStatus
  configStatus: CuttingConfigStatus
  receiveStatus: CuttingReceiveStatus
  configuredRollCount: number
  configuredLength: number
  receivedRollCount: number
  receivedLength: number
  printSlipStatus: CuttingPrintSlipStatus
  qrStatus: CuttingQrStatus
  batchOccupancyStatus?: CuttingBatchOccupancyStatus
  mergeBatchNo?: string
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
  /**
   * @deprecated legacy filter kept only for backward compatibility; cutting domain pages no longer expose
   * or depend on review-based filtering.
   */
  auditStatus: 'ALL' | 'PENDING' | 'PARTIAL' | 'APPROVED'
  configStatus: 'ALL' | CuttingConfigStatus
  receiveStatus: 'ALL' | CuttingReceiveStatus
  riskFilter: 'ALL' | 'RISK_ONLY'
}
