/**
 * store-domain-quality-types.ts
 * 质量域类型定义与纯 helper — 无 React 依赖
 * 当前原型仓直接使用的质量域类型定义文件
 */

export type QcStatus = 'DRAFT' | 'SUBMITTED' | 'CLOSED'
export type QcDisposition = 'REWORK' | 'REMAKE' | 'ACCEPT_AS_DEFECT' | 'SCRAP' | 'ACCEPT'
export type RootCauseType = 'PROCESS' | 'MATERIAL' | 'DYE_PRINT' | 'CUTTING' | 'PATTERN_TECH' | 'UNKNOWN'

// =============================================
// 基础质量类型
// =============================================
export type QcResult = 'PASS' | 'FAIL'

export type LiabilityStatus = 'DRAFT' | 'CONFIRMED' | 'DISPUTED' | 'VOID'

// =============================================
// Allocation 快照与事件
// =============================================
export interface AllocationSnapshot {
  taskId: string
  availableQty: number
  acceptedAsDefectQty: number
  scrappedQty: number
  updatedAt: string
  updatedBy: string
}

export interface AllocationEvent {
  eventId: string
  taskId: string
  refType: 'QC' | 'RETURN_BATCH' | 'DYE_PRINT_ORDER'
  refId: string
  deltaAvailableQty: number
  deltaAcceptedAsDefectQty: number
  deltaScrappedQty: number
  noteZh: string
  createdAt: string
  createdBy: string
}

// =============================================
// 回货批次（分批质检放行）
// =============================================
export type ReturnBatchQcStatus = 'QC_PENDING' | 'PASS_CLOSED' | 'FAIL_IN_QC'

export interface ReturnBatch {
  batchId: string
  taskId: string
  returnedQty: number
  qcStatus: ReturnBatchQcStatus
  linkedQcId?: string
  sourceType?: 'TASK' | 'DYE_PRINT_ORDER'
  sourceId?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

// =============================================
// 染印加工单（次链路工单）
// =============================================
export type DyePrintProcessType = 'PRINT' | 'DYE' | 'DYE_PRINT'
export type DyePrintOrderStatus = 'DRAFT' | 'PROCESSING' | 'PARTIAL_RETURNED' | 'COMPLETED' | 'CLOSED'
export type DyePrintSettlementRelation = 'GROUP_INTERNAL' | 'EXTERNAL' | 'SPECIAL'
export type DyePrintReturnResult = 'PASS' | 'FAIL'

export type SettlementPartyType = 'FACTORY' | 'SUPPLIER' | 'PROCESSOR' | 'GROUP_INTERNAL' | 'OTHER'

export function deriveDyePrintSettlementRelation(
  processorFactoryId: string,
  settlementPartyType: SettlementPartyType,
  settlementPartyId: string,
): DyePrintSettlementRelation {
  if (settlementPartyType === 'GROUP_INTERNAL') return 'GROUP_INTERNAL'
  if (settlementPartyId === processorFactoryId) return 'GROUP_INTERNAL'
  if (settlementPartyType === 'OTHER') return 'SPECIAL'
  return 'EXTERNAL'
}

export interface DyePrintReturnBatch {
  returnId: string
  returnedAt: string
  qty: number
  result: DyePrintReturnResult
  disposition?: QcDisposition
  remark?: string
  qcId?: string
  effectiveAvailableQty?: number
  qcClosedAt?: string
}

export interface DyePrintOrder {
  dpId: string
  /** alias kept for back-compat with ReturnBatch.sourceId lookup */
  orderId: string
  productionOrderId: string
  relatedTaskId: string
  processorFactoryId: string
  processorFactoryName: string
  settlementPartyType: SettlementPartyType
  settlementPartyId: string
  settlementRelation: DyePrintSettlementRelation
  processType: DyePrintProcessType
  plannedQty: number
  returnedPassQty: number
  returnedFailQty: number
  availableQty: number
  status: DyePrintOrderStatus
  remark?: string
  returnBatches: DyePrintReturnBatch[]
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

// =============================================
// Default responsibility helper
// =============================================
export function defaultResponsibility(
  rootCauseType: RootCauseType,
  refTaskAssignedFactoryId?: string,
): { responsiblePartyType: SettlementPartyType; responsiblePartyId: string } {
  switch (rootCauseType) {
    case 'PROCESS':
      return { responsiblePartyType: 'FACTORY', responsiblePartyId: refTaskAssignedFactoryId || 'FAC-001' }
    case 'MATERIAL':
      return { responsiblePartyType: 'SUPPLIER', responsiblePartyId: 'SUP-001' }
    case 'DYE_PRINT':
      return { responsiblePartyType: 'PROCESSOR', responsiblePartyId: 'PROC-DP-001' }
    default:
      return { responsiblePartyType: 'OTHER', responsiblePartyId: 'OTHER-001' }
  }
}

// =============================================
// QC 检验单类型
// =============================================
export interface DefectItem {
  defectCode: string
  defectName: string
  qty: number
  remark?: string
}

export interface QcAuditLog {
  id: string
  action: string
  detail: string
  at: string
  by: string
}

export interface QualityInspection {
  qcId: string
  refType: 'TASK' | 'HANDOVER' | 'RETURN_BATCH'
  refId: string
  refTaskId?: string
  productionOrderId: string
  inspector: string
  inspectedAt: string
  result: QcResult
  defectItems: DefectItem[]
  remark?: string
  status: QcStatus
  disposition?: QcDisposition
  affectedQty?: number
  rootCauseType: RootCauseType
  responsiblePartyType?: SettlementPartyType
  responsiblePartyId?: string
  liabilityStatus: LiabilityStatus
  liablePartyType?: SettlementPartyType
  liablePartyId?: string
  settlementPartyType?: SettlementPartyType
  settlementPartyId?: string
  liabilityReason?: string
  liabilityConfirmedAt?: string
  liabilityConfirmedBy?: string
  disputeRemark?: string
  arbitrationResult?: 'UPHOLD' | 'REASSIGN' | 'VOID_DEDUCTION'
  arbitrationRemark?: string
  arbitratedAt?: string
  arbitratedBy?: string
  closedAt?: string
  closedBy?: string
  dispositionQtyBreakdown?: {
    reworkQty?: number
    remakeQty?: number
    acceptAsDefectQty?: number
    scrapQty?: number
    acceptNoDeductQty?: number
  }
  generatedTaskIds?: string[]
  sourceProcessType?: 'DYE_PRINT'
  sourceOrderId?: string
  sourceReturnId?: string
  auditLogs: QcAuditLog[]
  createdAt: string
  updatedAt: string
}

// =============================================
// 扣款候选 / 扣款依据类型
// =============================================
export type DeductionReasonCode = 'QUALITY_FAIL' | 'HANDOVER_DIFF' | 'DELAY' | 'OTHER'
export type DeductionStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SETTLED'

export interface DeductionEvidenceRef {
  name: string
  url: string
}

export interface DeductionCandidate {
  candidateId: string
  qcId?: string
  productionOrderId: string
  taskId: string
  factoryId: string
  reasonCode: DeductionReasonCode
  affectedQty: number
  disposition?: QcDisposition
  evidenceRefs: DeductionEvidenceRef[]
  status: DeductionStatus
  createdAt: string
  createdBy: string
  updatedAt?: string
}

// =============================================
// 扣款依据（输入台账）
// =============================================
export type DeductionBasisSourceType = 'QC_FAIL' | 'QC_DEFECT_ACCEPT' | 'HANDOVER_DIFF'
export type DeductionBasisStatus = 'DRAFT' | 'CONFIRMED' | 'DISPUTED' | 'VOID'
export type DeductionBasisReasonCode =
  | 'QUALITY_FAIL'
  | 'HANDOVER_SHORTAGE'
  | 'HANDOVER_OVERAGE'
  | 'HANDOVER_DAMAGE'
  | 'HANDOVER_MIXED_BATCH'
  | 'HANDOVER_DIFF'

export interface DeductionBasisEvidenceRef {
  name: string
  url?: string
  type?: string
}

export interface DeductionBasisAuditLog {
  id: string
  action: string
  detail: string
  at: string
  by: string
}

export interface DeductionBasisItem {
  basisId: string
  sourceType: DeductionBasisSourceType
  sourceRefId: string
  sourceId?: string
  productionOrderId: string
  taskId?: string
  refHandoverId?: string
  factoryId: string
  settlementPartyType?: SettlementPartyType
  settlementPartyId?: string
  rootCauseType?: RootCauseType
  reasonCode: DeductionBasisReasonCode
  qty: number
  deductionQty?: number
  uom: 'PIECE'
  disposition?: QcDisposition
  summary?: string
  evidenceRefs: DeductionBasisEvidenceRef[]
  status: DeductionBasisStatus
  deepLinks: { qcHref?: string; taskHref?: string; handoverHref?: string }
  liablePartyType?: SettlementPartyType
  liablePartyId?: string
  liabilityReason?: string
  liabilityConfirmedAt?: string
  liabilityConfirmedBy?: string
  sourceProcessType?: 'DYE_PRINT'
  sourceOrderId?: string
  sourceReturnId?: string
  processorFactoryId?: string
  settlementReady?: boolean
  settlementFreezeReason?: string
  qcStatusSnapshot?: 'DRAFT' | 'SUBMITTED' | 'CLOSED'
  liabilityStatusSnapshot?: 'PENDING' | 'CONFIRMED' | 'DISPUTED'
  deductionAmountEditable?: boolean
  arbitrationResult?: 'UPHOLD' | 'REASSIGN' | 'VOID_DEDUCTION'
  arbitrationRemark?: string
  arbitratedAt?: string
  arbitratedBy?: string
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
  auditLogs: DeductionBasisAuditLog[]
}
