import type {
  SettlementConfigSnapshot,
  SettlementDefaultDeductionRuleSnapshot,
  SettlementEffectiveInfoSnapshot,
} from './settlement-change-requests'

export type AdjustmentStatus = 'DRAFT' | 'EFFECTIVE' | 'VOID'
export type AdjustmentType = 'DEDUCTION_SUPPLEMENT' | 'COMPENSATION' | 'REVERSAL'
export type StatementStatus = 'DRAFT' | 'CONFIRMED' | 'CLOSED'
export type FactoryFeedbackStatus =
  | 'NOT_SENT'
  | 'PENDING_FACTORY_CONFIRM'
  | 'FACTORY_CONFIRMED'
  | 'FACTORY_APPEALED'
  | 'PLATFORM_HANDLING'
  | 'RESOLVED'
export type StatementSourceItemType =
  | 'QUALITY_BASIS'
  | 'PAYABLE_ADJUSTMENT'
  | 'MATERIAL_STATEMENT'

export interface SettlementProfileSnapshot {
  versionNo: string
  effectiveAt: string
  sourceFactoryId: string
  sourceFactoryName: string
  settlementConfigSnapshot: SettlementConfigSnapshot
  receivingAccountSnapshot: SettlementEffectiveInfoSnapshot
  defaultDeductionRulesSnapshot: SettlementDefaultDeductionRuleSnapshot[]
}

export interface StatementFactoryAppealRecord {
  appealId: string
  status: 'SUBMITTED' | 'PLATFORM_HANDLING' | 'RESOLVED'
  reason: string
  description: string
  evidenceSummary?: string
  submittedAt: string
  submittedBy: string
  platformRemark?: string
  handledAt?: string
  handledBy?: string
}

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

export interface StatementAdjustment extends PayableAdjustment {
  statementId?: string
}

export type SettlementBatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED'

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

export interface SettlementBatchItem {
  statementId: string
  settlementPartyType: string
  settlementPartyId: string
  totalAmount: number
  settlementProfileVersionNo?: string
  settlementProfileSnapshot?: SettlementProfileSnapshot
  factoryFeedbackStatus?: FactoryFeedbackStatus
}

export interface SettlementBatch {
  batchId: string
  batchName?: string
  itemCount: number
  totalAmount: number
  status: SettlementBatchStatus
  statementIds: string[]
  items: SettlementBatchItem[]
  remark?: string
  createdAt: string
  createdBy: string
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

export interface StatementDraftItem {
  sourceItemId: string
  sourceItemType: StatementSourceItemType
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
  sourceOrderId?: string
  taskId?: string
}

export interface StatementDraft {
  statementId: string
  settlementPartyType: string
  settlementPartyId: string
  settlementRelation?: 'GROUP_INTERNAL' | 'EXTERNAL' | 'SPECIAL'
  itemCount: number
  totalQty: number
  totalAmount: number
  status: StatementStatus
  itemBasisIds: string[]
  itemSourceIds?: string[]
  items: StatementDraftItem[]
  remark?: string
  settlementProfileSnapshot: SettlementProfileSnapshot
  settlementProfileVersionNo: string
  statementPartyView?: string
  factoryFeedbackStatus: FactoryFeedbackStatus
  factoryFeedbackAt?: string
  factoryFeedbackBy?: string
  factoryFeedbackRemark?: string
  factoryAppealRecord?: StatementFactoryAppealRecord
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}
