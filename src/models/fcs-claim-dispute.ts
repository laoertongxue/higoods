export type ClaimDisputeStatus =
  | 'PENDING'
  | 'VIEWED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'COMPLETED'

export type ClaimDisputeSourceType = 'CUT_PIECE'

export type ClaimDisputeSubmitSource = 'PDA'

export type ClaimDisputeTaskType = 'CUTTING'

export interface ClaimDisputeEvidenceFile {
  fileId: string
  fileType: 'IMAGE' | 'VIDEO'
  fileName: string
  fileUrl?: string
  uploadedAt: string
}

export interface ClaimDisputeRecord {
  disputeId: string
  disputeNo: string
  sourceTaskType: ClaimDisputeTaskType
  isCutPieceTask: boolean
  sourceTaskId: string
  sourceTaskNo: string
  originalCutOrderNo: string
  originalCutOrderNos: string[]
  productionOrderNo: string
  productionOrderNos: string[]
  relatedClaimRecordNo: string
  materialSku: string
  materialCategory: string
  materialAttr: string
  configuredQty: number
  defaultClaimQty: number
  actualClaimQty: number
  discrepancyQty: number
  disputeReason: string
  disputeNote: string
  submittedBy: string
  submittedAt: string
  submittedSource: ClaimDisputeSubmitSource
  imageFiles: ClaimDisputeEvidenceFile[]
  videoFiles: ClaimDisputeEvidenceFile[]
  evidenceCount: number
  hasEvidence: boolean
  status: ClaimDisputeStatus
  processingStatus: ClaimDisputeStatus
  handledBy: string
  handledAt: string
  handleNote: string
  handleConclusion: string
  writtenBackToCraft: boolean
  writtenBackToPda: boolean
  platformCaseId: string
  generatedAt: string
  note: string
}

export interface ClaimDisputeCreateInput {
  sourceTaskId: string
  sourceTaskNo: string
  originalCutOrderNo: string
  originalCutOrderNos?: string[]
  productionOrderNo: string
  productionOrderNos?: string[]
  relatedClaimRecordNo: string
  materialSku: string
  materialCategory?: string
  materialAttr?: string
  configuredQty: number
  defaultClaimQty?: number
  actualClaimQty: number
  disputeReason: string
  disputeNote: string
  submittedBy: string
  submittedAt: string
  imageFiles?: ClaimDisputeEvidenceFile[]
  videoFiles?: ClaimDisputeEvidenceFile[]
  note?: string
  isReimported?: boolean
}

export interface ClaimDisputeHandleInput {
  status: ClaimDisputeStatus
  handledBy: string
  handledAt: string
  handleNote: string
  handleConclusion: string
}

