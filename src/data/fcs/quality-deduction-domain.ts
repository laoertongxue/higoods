import type {
  DeductionBasisAuditLog,
  DeductionBasisSourceType,
  DefectItem,
  QcDisposition,
  QcAuditLog,
  QcStatus,
  ReturnInboundProcessType,
  ReturnInboundQcPolicy,
  ReturnInboundSourceBusinessType,
  RootCauseType,
  SettlementPartyType,
  SewPostProcessMode,
} from './store-domain-quality-types'

export type QualityDeductionQcResult = 'QUALIFIED' | 'PARTIALLY_QUALIFIED' | 'UNQUALIFIED'

export type QualityDeductionLiabilityStatus = 'PENDING' | 'FACTORY' | 'NON_FACTORY' | 'MIXED'

export type QualityDeductionFactoryResponseStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_RESPONSE'
  | 'CONFIRMED'
  | 'AUTO_CONFIRMED'
  | 'DISPUTED'

export type QualityDeductionFactoryResponseAction = 'CONFIRM' | 'DISPUTE' | 'AUTO_CONFIRM'

export type QualityDeductionDisputeStatus =
  | 'NONE'
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'UPHELD'
  | 'PARTIALLY_ADJUSTED'
  | 'REVERSED'
  | 'CLOSED'

export type QualityDeductionDisputeAdjudicationResult =
  | 'UPHELD'
  | 'PARTIALLY_ADJUSTED'
  | 'REVERSED'

export type QualityDeductionBasisStatus =
  | 'NOT_GENERATED'
  | 'GENERATED'
  | 'EFFECTIVE'
  | 'ADJUSTED'
  | 'CANCELLED'

export type QualityDeductionSettlementImpactStatus =
  | 'NO_IMPACT'
  | 'BLOCKED'
  | 'ELIGIBLE'
  | 'INCLUDED_IN_STATEMENT'
  | 'SETTLED'
  | 'NEXT_CYCLE_ADJUSTMENT_PENDING'

export type QualityDeductionSettlementAdjustmentType =
  | 'INCREASE_DEDUCTION'
  | 'DECREASE_DEDUCTION'
  | 'REVERSAL'

export type QualityDeductionSettlementAdjustmentWritebackStatus =
  | 'NOT_WRITTEN'
  | 'PENDING_WRITEBACK'
  | 'WRITTEN'

export type QualityDeductionCaseStatus =
  | 'NO_ACTION'
  | 'WAIT_FACTORY_RESPONSE'
  | 'WAIT_PLATFORM_REVIEW'
  | 'AUTO_CONFIRMED_PENDING_SETTLEMENT'
  | 'ADJUDICATED_PENDING_SETTLEMENT'
  | 'READY_FOR_SETTLEMENT'
  | 'SETTLED'
  | 'ADJUSTMENT_PENDING'
  | 'CLOSED'

export type QualityEvidenceAssetType = 'IMAGE' | 'VIDEO' | 'DOCUMENT'

export interface QualityEvidenceAsset {
  assetId: string
  name: string
  assetType: QualityEvidenceAssetType
  url?: string
}

export interface QcRecordFact {
  qcId: string
  qcNo: string
  routeAliases: string[]
  isLegacy: boolean
  refType: 'TASK' | 'HANDOVER' | 'RETURN_BATCH'
  refId: string
  refTaskId?: string
  sourceTypeLabel: string
  returnInboundBatchNo: string
  productionOrderNo: string
  taskId?: string
  processType: ReturnInboundProcessType
  processLabel: string
  qcPolicy: ReturnInboundQcPolicy
  qcStatus: QcStatus
  inspectorUserName: string
  inspectedAt: string
  defectItems: DefectItem[]
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  qcResult: QualityDeductionQcResult
  unqualifiedDisposition?: QcDisposition
  unqualifiedReasonSummary?: string
  remark?: string
  rootCauseType: RootCauseType
  liabilityStatus: QualityDeductionLiabilityStatus
  factoryLiabilityQty: number
  nonFactoryLiabilityQty: number
  responsiblePartyType?: SettlementPartyType
  responsiblePartyId?: string
  responsiblePartyName?: string
  deductionDecision?: 'DEDUCT' | 'NO_DEDUCT'
  deductionDecisionRemark?: string
  dispositionRemark?: string
  liabilityDecidedAt?: string
  liabilityDecidedBy?: string
  returnFactoryId?: string
  returnFactoryName?: string
  warehouseId?: string
  warehouseName?: string
  inboundAt?: string
  inboundBy?: string
  sourceBusinessType?: ReturnInboundSourceBusinessType
  sourceBusinessId?: string
  sourceOrderId?: string
  sewPostProcessMode?: SewPostProcessMode
  writebackAvailableQty?: number
  writebackAcceptedAsDefectQty?: number
  writebackScrapQty?: number
  writebackCompletedAt?: string
  writebackCompletedBy?: string
  downstreamUnblocked?: boolean
  evidenceAssets: QualityEvidenceAsset[]
  auditLogs: QcAuditLog[]
  createdAt: string
  updatedAt: string
  closedAt?: string
  closedBy?: string
}

export interface FactoryResponseFact {
  responseId: string
  qcId: string
  factoryId?: string
  factoryResponseStatus: QualityDeductionFactoryResponseStatus
  responseDeadlineAt?: string
  respondedAt?: string
  autoConfirmedAt?: string
  responderUserName?: string
  responseAction?: QualityDeductionFactoryResponseAction
  responseComment?: string
  isOverdue: boolean
}

export interface QualityDeductionFactoryConfirmInput {
  qcId: string
  responderUserName: string
  respondedAt?: string
  responseComment?: string
}

export interface DeductionBasisFact {
  basisId: string
  qcId: string
  sourceType: DeductionBasisSourceType
  status: QualityDeductionBasisStatus
  productionOrderNo: string
  taskId?: string
  returnInboundBatchNo?: string
  sourceBusinessType?: ReturnInboundSourceBusinessType
  sourceBusinessId?: string
  processType?: ReturnInboundProcessType
  processLabel?: string
  settlementPartyType?: SettlementPartyType
  settlementPartyId?: string
  responsiblePartyType?: SettlementPartyType
  responsiblePartyId?: string
  responsiblePartyName?: string
  rootCauseType?: RootCauseType
  deductionQty: number
  blockedProcessingFeeAmount: number
  proposedQualityDeductionAmount: number
  effectiveQualityDeductionAmount: number
  unqualifiedDisposition?: QcDisposition
  effectiveAt?: string
  adjustedAt?: string
  cancelledAt?: string
  adjustmentReasonSummary?: string
  summary: string
  evidenceAssets: QualityEvidenceAsset[]
  auditLogs: DeductionBasisAuditLog[]
  createdAt: string
  updatedAt?: string
  createdBy: string
  updatedBy?: string
}

export interface DisputeCaseFact {
  disputeId: string
  qcId: string
  basisId: string
  status: QualityDeductionDisputeStatus
  disputeReasonCode: string
  disputeReasonName: string
  disputeDescription: string
  disputeEvidenceAssets: QualityEvidenceAsset[]
  submittedAt?: string
  submittedByUserName?: string
  reviewerUserName?: string
  adjudicatedAt?: string
  adjudicationResult?: QualityDeductionDisputeAdjudicationResult
  adjudicationComment?: string
  requestedAmount?: number
  adjudicatedAmount?: number
  adjustedLiableQty?: number
  adjustedBlockedProcessingFeeAmount?: number
  adjustedEffectiveQualityDeductionAmount?: number
  adjustmentReasonSummary?: string
  resultWrittenBackAt?: string
}

export interface QualityDeductionDisputeSubmissionInput {
  qcId: string
  submittedByUserName: string
  submittedAt?: string
  disputeReasonCode: string
  disputeReasonName: string
  disputeDescription: string
  disputeEvidenceAssets: QualityEvidenceAsset[]
}

export interface QualityDeductionDisputeAdjudicationInput {
  qcId: string
  reviewerUserName: string
  adjudicatedAt?: string
  adjudicationResult: QualityDeductionDisputeAdjudicationResult
  adjudicationComment: string
  adjustedLiableQty?: number
  adjustedBlockedProcessingFeeAmount?: number
  adjustedEffectiveQualityDeductionAmount?: number
  adjustmentReasonSummary?: string
}

export interface SettlementImpactFact {
  impactId: string
  qcId: string
  basisId?: string
  factoryId?: string
  returnInboundBatchNo: string
  status: QualityDeductionSettlementImpactStatus
  blockedSettlementQty: number
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  candidateSettlementCycleId?: string
  includedAt?: string
  includedSettlementStatementId?: string
  includedSettlementBatchId?: string
  statementLockedAt?: string
  eligibleAt?: string
  settledAt?: string
  lastWrittenBackAt?: string
  totalFinancialImpactAmount: number
  summary: string
}

export interface SettlementAdjustmentFact {
  adjustmentId: string
  adjustmentNo: string
  qcId: string
  basisId: string
  disputeId: string
  adjustmentType: QualityDeductionSettlementAdjustmentType
  adjustmentQty: number
  adjustmentAmount: number
  currency: string
  targetSettlementCycleId: string
  adjustmentReasonCode?: string
  adjustmentReasonSummary?: string
  writebackStatus: QualityDeductionSettlementAdjustmentWritebackStatus
  generatedAt: string
  writtenBackAt?: string
  summary: string
}

export interface QualityDeductionCaseFact {
  qcRecord: QcRecordFact
  factoryResponse: FactoryResponseFact | null
  deductionBasis: DeductionBasisFact | null
  disputeCase: DisputeCaseFact | null
  settlementImpact: SettlementImpactFact
  settlementAdjustment: SettlementAdjustmentFact | null
}

export function deriveQualityDeductionCaseStatus(
  input: Pick<QualityDeductionCaseFact, 'qcRecord' | 'factoryResponse' | 'disputeCase' | 'settlementImpact'>,
): QualityDeductionCaseStatus {
  const { qcRecord, factoryResponse, disputeCase, settlementImpact } = input

  if (settlementImpact.status === 'SETTLED') {
    return 'SETTLED'
  }

  if (settlementImpact.status === 'NEXT_CYCLE_ADJUSTMENT_PENDING') {
    return 'ADJUSTMENT_PENDING'
  }

  if (
    factoryResponse &&
    (factoryResponse.factoryResponseStatus === 'PENDING_RESPONSE' ||
      (factoryResponse.factoryResponseStatus === 'DISPUTED' &&
        (disputeCase?.status === 'NONE' || !disputeCase)))
  ) {
    return 'WAIT_FACTORY_RESPONSE'
  }

  if (
    disputeCase &&
    (disputeCase.status === 'PENDING_REVIEW' || disputeCase.status === 'IN_REVIEW')
  ) {
    return 'WAIT_PLATFORM_REVIEW'
  }

  if (
    factoryResponse?.factoryResponseStatus === 'AUTO_CONFIRMED' &&
    (settlementImpact.status === 'ELIGIBLE' || settlementImpact.status === 'INCLUDED_IN_STATEMENT')
  ) {
    return 'AUTO_CONFIRMED_PENDING_SETTLEMENT'
  }

  if (
    disputeCase?.adjudicationResult &&
    (settlementImpact.status === 'ELIGIBLE' || settlementImpact.status === 'INCLUDED_IN_STATEMENT')
  ) {
    return 'ADJUDICATED_PENDING_SETTLEMENT'
  }

  if (
    settlementImpact.status === 'ELIGIBLE' ||
    settlementImpact.status === 'INCLUDED_IN_STATEMENT'
  ) {
    return 'READY_FOR_SETTLEMENT'
  }

  if (
    qcRecord.qcStatus === 'CLOSED' &&
    (settlementImpact.status === 'NO_IMPACT' || settlementImpact.status === 'BLOCKED')
  ) {
    return 'CLOSED'
  }

  return 'NO_ACTION'
}
