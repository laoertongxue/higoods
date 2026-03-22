export type PickupScenarioType = 'COMMON' | 'CUTTING' | 'PRINTING' | 'DYEING'

export type PickupBoundObjectType = 'TASK' | 'CUT_PIECE_ORDER' | 'PRINT_ORDER' | 'DYE_ORDER' | 'MATERIAL_LINE'

export type PickupMaterialType = 'GENERAL' | 'PRINT' | 'DYE' | 'SOLID' | 'LINING'

export type PickupSlipStatus =
  | 'PENDING_PRINT'
  | 'READY_TO_PICKUP'
  | 'PARTIAL_RECEIVED'
  | 'RECEIVED'
  | 'RECHECK_REQUIRED'

export type PickupQrReusePolicy = 'REUSE_BY_BOUND_OBJECT'

export type PickupQrBindingStatus = 'ACTIVE' | 'DISABLED'

export type PickupScanResultStatus = 'MATCHED' | 'RECHECK_REQUIRED' | 'PHOTO_SUBMITTED' | 'CANCELLED'

export type PickupEvidenceType = 'PHOTO' | 'MANUAL_NOTE' | 'RECEIPT_NOTE'

export type PickupReceiptStatus = 'NOT_SCANNED' | 'SCANNED_MATCHED' | 'SCANNED_RECHECK' | 'PHOTO_SUBMITTED' | 'CANCELLED'

export interface PickupQtySummary {
  unitLabel: string
  itemCount: number
  rollCount?: number
  length?: number
  summaryText: string
}

export interface PickupEvidenceSummary {
  totalCount: number
  photoCount: number
  manualNoteCount: number
  receiptNoteCount: number
  latestEvidenceSummary: string
}

export interface PickupSlip {
  pickupSlipNo: string
  scenarioType: PickupScenarioType
  sourceTaskType: string
  sourceTaskNo: string
  productionOrderNo: string
  boundObjectType: PickupBoundObjectType
  boundObjectNo: string
  factoryType: string
  factoryName: string
  materialSku: string
  materialType: PickupMaterialType
  plannedQtySummary: PickupQtySummary
  configuredQtySummary: PickupQtySummary
  receivedQtySummary: PickupQtySummary
  currentStatus: PickupSlipStatus
  latestPrintVersionNo: string
  latestQrCodeValue: string
  latestScanResult: PickupScanResultStatus | null
  hasDiscrepancy: boolean
  evidenceSummary: PickupEvidenceSummary
  createdAt: string
  updatedAt: string
}

export interface PickupPrintVersion {
  pickupSlipNo: string
  printVersionNo: string
  printedAt: string
  printedBy: string
  printCopyCount: number
  snapshotSummary: string
  isLatestVersion: boolean
}

export interface PickupQrBinding {
  qrCodeValue: string
  boundObjectType: PickupBoundObjectType
  boundObjectNo: string
  scenarioType: PickupScenarioType
  reusePolicy: PickupQrReusePolicy
  generatedAt: string
  generatedBy: string
  status: PickupQrBindingStatus
  latestPrintVersionNo: string
}

export interface PickupScanRecord {
  scanRecordNo: string
  pickupSlipNo: string
  qrCodeValue: string
  boundObjectNo: string
  scannedAt: string
  scannedBy: string
  resultStatus: PickupScanResultStatus
  receivedQtySummary: PickupQtySummary
  photoProofCount: number
  note: string
}

export interface PickupEvidence {
  evidenceNo: string
  pickupSlipNo: string
  relatedScanRecordNo: string
  evidenceType: PickupEvidenceType
  count: number
  summary: string
  createdAt: string
  createdBy: string
}

export interface PickupReceiptSummary {
  pickupSlipNo: string
  latestResultStatus: PickupScanResultStatus | 'NOT_SCANNED'
  latestResultLabel: string
  latestScannedAt: string
  latestScannedBy: string
  hasPhotoEvidence: boolean
  needsRecheck: boolean
  receiptStatus: PickupReceiptStatus
}

export interface PickupScenarioDifferenceSummary {
  scenarioType: PickupScenarioType
  boundObjectType: PickupBoundObjectType
  qrMeaning: string
  discrepancySupport: string
  followUpActions: string
  summaryText: string
}
