export type AdjustmentStatus = 'DRAFT' | 'EFFECTIVE' | 'VOID'
export type AdjustmentType = 'DEDUCTION_SUPPLEMENT' | 'COMPENSATION' | 'REVERSAL'

export interface StatementAdjustment {
  adjustmentId: string
  statementId: string
  adjustmentType: AdjustmentType
  amount: number
  remark: string
  relatedBasisId?: string
  status: AdjustmentStatus
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
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
  updatedAt?: string
  updatedBy?: string
  paymentSyncStatus?: 'UNSYNCED' | 'SUCCESS' | 'FAILED' | 'PARTIAL'
  paymentAmount?: number
  paymentAt?: string
  paymentReferenceNo?: string
  paymentRemark?: string
  paymentUpdatedAt?: string
  paymentUpdatedBy?: string
}

export type StatementStatus = 'DRAFT' | 'CONFIRMED' | 'CLOSED'

export interface StatementDraftItem {
  basisId: string
  deductionQty: number
  deductionAmount: number
  sourceProcessType?: string
  sourceType?: string
  productionOrderId?: string
  sourceOrderId?: string
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
  items: StatementDraftItem[]
  remark?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}
