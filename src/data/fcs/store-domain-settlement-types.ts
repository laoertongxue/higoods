import type {
  SettlementConfigSnapshot,
  SettlementDefaultDeductionRuleSnapshot,
  SettlementEffectiveInfoSnapshot,
} from './settlement-change-requests.ts'
import type { StatementPricingFields } from './store-domain-statement-grain.ts'

export type AdjustmentStatus = 'DRAFT' | 'EFFECTIVE' | 'VOID'
export type AdjustmentType = 'DEDUCTION_SUPPLEMENT' | 'COMPENSATION' | 'REVERSAL'
export type PreSettlementLedgerType = 'TASK_EARNING' | 'QUALITY_DEDUCTION'
export type PreSettlementLedgerDirection = 'INCOME' | 'DEDUCTION'
export type PreSettlementLedgerSourceType = 'RETURN_INBOUND_BATCH' | 'FORMAL_QUALITY_DEDUCTION_LEDGER'
export type PreSettlementLedgerPriceSourceType = 'DISPATCH' | 'BID' | 'OTHER_COMPAT'
export type PreSettlementLedgerStatus =
  | 'OPEN'
  | 'IN_STATEMENT'
  | 'IN_PREPAYMENT_BATCH'
  | 'PREPAID'
  | 'RESERVED_FOR_FINAL_SETTLEMENT'
/**
 * 平台侧对账单生命周期状态。
 * 仅表达平台主流程是否已下发、是否可结算、是否已关闭，不表达工厂确认或申诉结果。
 */
export type StatementStatus =
  | 'DRAFT'
  | 'PENDING_FACTORY_CONFIRM'
  | 'FACTORY_CONFIRMED'
  | 'READY_FOR_PREPAYMENT'
  | 'IN_PREPAYMENT_BATCH'
  | 'PREPAID'
  | 'CLOSED'
export type StatementResolutionResult = 'UPHELD' | 'REOPEN_REQUIRED'
export type FactoryFeedbackStatus =
  | 'NOT_SENT'
  | 'PENDING_FACTORY_CONFIRM'
  | 'FACTORY_CONFIRMED'
  | 'FACTORY_APPEALED'
  | 'PLATFORM_HANDLING'
  | 'RESOLVED'
export type StatementSourceItemType = 'TASK_EARNING' | 'QUALITY_DEDUCTION'
export type StatementLineGrainType =
  | 'RETURN_INBOUND_BATCH'
  | 'NON_BATCH_QUALITY'
  | 'NON_BATCH_ADJUSTMENT'
  | 'OTHER_SOURCE_OBJECT'

export interface SettlementProfileSnapshot {
  versionNo: string
  effectiveAt: string
  sourceFactoryId: string
  sourceFactoryName: string
  settlementConfigSnapshot: SettlementConfigSnapshot
  receivingAccountSnapshot: SettlementEffectiveInfoSnapshot
  defaultDeductionRulesSnapshot: SettlementDefaultDeductionRuleSnapshot[]
}

export interface StatementAppealRecord {
  appealId: string
  statementId: string
  factoryId: string
  settlementCycleId?: string
  status: 'SUBMITTED' | 'PLATFORM_HANDLING' | 'RESOLVED'
  reasonCode: string
  reasonName: string
  description: string
  attachments: string[]
  evidenceSummary?: string
  submittedAt: string
  submittedBy: string
  platformHandledAt?: string
  platformHandledBy?: string
  resolutionAt?: string
  resolutionResult?: StatementResolutionResult
  resolutionComment?: string
}

export type StatementFactoryAppealRecord = StatementAppealRecord

// 仅为过渡兼容保留的旧对象壳。当前结算主链已切到预结算流水，不应再把这里当作主真相源。
export interface PayableAdjustment {
  adjustmentId: string
  adjustmentType: AdjustmentType
  settlementPartyType: string
  settlementPartyId: string
  productionOrderId?: string
  taskId?: string
  amount: number
  currency: string
  remark: string
  relatedBasisId?: string
  status: AdjustmentStatus
  linkedStatementId?: string
  linkedStatementStatus?: StatementStatus
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

export interface PreSettlementLedger {
  ledgerId: string
  ledgerNo: string
  ledgerType: PreSettlementLedgerType
  direction: PreSettlementLedgerDirection
  sourceType: PreSettlementLedgerSourceType
  sourceRefId: string
  factoryId: string
  factoryName: string
  taskId?: string
  taskNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  returnInboundBatchId?: string
  returnInboundBatchNo?: string
  qcRecordId?: string
  pendingDeductionRecordId?: string
  disputeId?: string
  priceSourceType: PreSettlementLedgerPriceSourceType
  unitPrice?: number
  qty: number
  originalCurrency: string
  originalAmount: number
  settlementCurrency: string
  settlementAmount: number
  fxRate?: number
  fxAppliedAt?: string
  occurredAt: string
  settlementCycleId: string
  settlementCycleLabel: string
  settlementCycleStartAt: string
  settlementCycleEndAt: string
  settlementProfileVersionNo?: string
  statementId?: string
  prepaymentBatchId?: string
  status: PreSettlementLedgerStatus
  sourceReason?: string
  remark?: string
}

export interface StatementAdjustment extends PayableAdjustment {
  statementId?: string
}

export type PrepaymentBatchStatus =
  | 'DRAFT'
  | 'READY_TO_APPLY_PAYMENT'
  | 'FEISHU_APPROVAL_CREATED'
  | 'FEISHU_PAID_PENDING_WRITEBACK'
  | 'PREPAID'
  | 'CLOSED'
  | 'FEISHU_APPROVAL_REJECTED'
  | 'FEISHU_APPROVAL_CANCELED'

export type FeishuPaymentApprovalStatus =
  | 'CREATED'
  | 'APPROVING'
  | 'APPROVED_PENDING_PAYMENT'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELED'

export type ProductionChangeType =
  | 'QTY_CHANGE'
  | 'DATE_CHANGE'
  | 'FACTORY_CHANGE'
  | 'STYLE_CHANGE'
  | 'OTHER'

export type ProductionChangeStatus = 'DRAFT' | 'PENDING' | 'DONE' | 'CANCELLED'

export interface ProductionOrderChange {
  changeId: string
  productionOrderId: string
  changeType: ProductionChangeType
  beforeValue?: string
  afterValue?: string
  impactScopeZh?: string
  reason: string
  status: ProductionChangeStatus
  remark?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

export interface PrepaymentBatchStatementItem {
  statementId: string
  statementNo?: string
  factoryId?: string
  factoryName?: string
  settlementPartyType: string
  settlementPartyId: string
  settlementCycleId?: string
  settlementCycleLabel?: string
  totalAmount: number
  totalEarningAmount?: number
  totalDeductionAmount?: number
  statementStatus?: StatementStatus
  settlementProfileVersionNo?: string
  settlementProfileSnapshot?: SettlementProfileSnapshot
  factoryFeedbackStatus?: FactoryFeedbackStatus
  resolutionResult?: StatementResolutionResult
}

export interface FeishuPaymentApproval {
  approvalId: string
  approvalNo: string
  batchId: string
  factoryId: string
  factoryName: string
  amount: number
  currency: string
  payeeAccountSnapshotId: string
  payeeAccountSnapshotVersion: string
  title: string
  displayTitle: string
  status: FeishuPaymentApprovalStatus
  createdAt: string
  createdBy: string
  latestSyncedAt?: string
  approvedAt?: string
  paidAt?: string
  rejectedAt?: string
  canceledAt?: string
  feishuRawStatus?: string
  externalStatus?: string
  bankReceiptRef?: string
  bankReceiptName?: string
  bankSerialNo?: string
  payerBankAccountName?: string
  payerBankAccountNoMasked?: string
}

export interface PaymentWriteback {
  writebackId: string
  batchId: string
  approvalId: string
  approvalNo: string
  factoryId: string
  factoryName: string
  amount: number
  currency: string
  paidAt: string
  bankReceiptRef: string
  bankReceiptName: string
  bankSerialNo: string
  payerBankAccountName?: string
  payerBankAccountNoMasked?: string
  payeeAccountSnapshotId: string
  payeeAccountSnapshotVersion: string
  writtenBackAt: string
  writtenBackBy: string
  notes?: string
}

export interface PrepaymentBatch {
  batchId: string
  batchNo: string
  batchName?: string
  factoryId: string
  factoryName: string
  settlementCurrency: string
  payeeAccountSnapshotId: string
  payeeAccountSnapshotVersion: string
  itemCount: number
  totalStatementCount: number
  totalAmount: number
  totalPayableAmount: number
  totalEarningAmount: number
  totalDeductionAmount: number
  status: PrepaymentBatchStatus
  statementIds: string[]
  items: PrepaymentBatchStatementItem[]
  remark?: string
  notes?: string
  createdAt: string
  createdBy: string
  appliedForPaymentAt?: string
  feishuApprovalId?: string
  feishuApprovalNo?: string
  paymentWritebackId?: string
  prepaidAt?: string
  closedAt?: string
  completedAt?: string
  archivedAt?: string
  updatedAt?: string
  updatedBy?: string
  paymentSyncStatus?: 'UNSYNCED' | 'SUCCESS' | 'FAILED' | 'PARTIAL'
  paymentAmount?: number
  paymentAt?: string
  paymentReferenceNo?: string
  paymentRemark?: string
  paymentUpdatedAt?: string
  paymentUpdatedBy?: string
  settlementProfileVersionSummary?: string
  settlementProfileSnapshotRefs?: SettlementProfileSnapshot[]
}

export type SettlementBatchStatus = PrepaymentBatchStatus
export type SettlementBatchItem = PrepaymentBatchStatementItem
export type SettlementBatch = PrepaymentBatch

export interface StatementDraftItem {
  ledgerNo?: string
  sourceItemId: string
  sourceItemType: StatementSourceItemType
  direction?: PreSettlementLedgerDirection
  sourceLabelZh?: string
  sourceRefLabel?: string
  routeToSource?: string
  settlementPartyType?: string
  settlementPartyId?: string
  basisId: string
  deductionQty: number
  deductionAmount: number
  currency?: string
  remark?: string
  sourceProcessType?: string
  sourceType?: string
  productionOrderId?: string
  productionOrderNo?: string
  sourceOrderId?: string
  taskId?: string
  taskNo?: string
  settlementCycleId?: string
  settlementCycleLabel?: string
  settlementCycleStartAt?: string
  settlementCycleEndAt?: string
  statementLineGrainType?: StatementLineGrainType
  returnInboundBatchId?: string
  returnInboundBatchNo?: string
  returnInboundQty?: number
  qcRecordId?: string
  pendingDeductionRecordId?: string
  disputeId?: string
  processLabel?: string
  pricingSourceType?: StatementPricingFields['pricingSourceType']
  pricingSourceRefId?: string
  settlementUnitPrice?: number
  earningAmount?: number
  qualityDeductionAmount?: number
  carryOverAdjustmentAmount?: number
  otherAdjustmentAmount?: number
  netAmount?: number
  occurredAt?: string
}

export interface StatementDraft {
  statementId: string
  statementNo?: string
  factoryId?: string
  factoryName?: string
  settlementPartyType: string
  settlementPartyId: string
  settlementRelation?: 'GROUP_INTERNAL' | 'EXTERNAL' | 'SPECIAL'
  itemCount: number
  totalQty: number
  totalAmount: number
  settlementCurrency?: string
  ledgerIds?: string[]
  earningLedgerIds?: string[]
  deductionLedgerIds?: string[]
  totalEarningAmount?: number
  totalDeductionAmount?: number
  netPayableAmount?: number
  /** 平台侧对账单生命周期状态 */
  status: StatementStatus
  itemBasisIds: string[]
  itemSourceIds?: string[]
  items: StatementDraftItem[]
  remark?: string
  settlementProfileSnapshot: SettlementProfileSnapshot
  settlementProfileVersionNo: string
  statementPartyView?: string
  settlementCycleId?: string
  settlementCycleLabel?: string
  settlementCycleStartAt?: string
  settlementCycleEndAt?: string
  sentToFactoryAt?: string
  factoryConfirmedAt?: string
  /** 工厂反馈状态轴，与平台侧生命周期状态并存。 */
  factoryFeedbackStatus: FactoryFeedbackStatus
  factoryFeedbackAt?: string
  factoryFeedbackBy?: string
  factoryFeedbackRemark?: string
  appealSubmittedAt?: string
  appealSubmittedBy?: string
  platformHandledAt?: string
  platformHandledBy?: string
  resolutionAt?: string
  resolutionResult?: StatementResolutionResult
  resolutionComment?: string
  readyForPrepaymentAt?: string
  prepaymentBatchId?: string
  prepaymentBatchNo?: string
  prepaymentBatchStatus?: PrepaymentBatchStatus
  feishuApprovalId?: string
  feishuApprovalNo?: string
  paymentWritebackId?: string
  prepaidAt?: string
  closedAt?: string
  notes?: string
  factoryAppealRecord?: StatementFactoryAppealRecord
  appealRecords?: StatementAppealRecord[]
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}
