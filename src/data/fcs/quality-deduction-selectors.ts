import type {
  DeductionBasisItem,
  DeductionBasisSourceType,
  DeductionBasisStatus,
  QualityInspection,
  QcDisposition,
  QcStatus,
  ReturnInboundProcessType,
  ReturnInboundQcPolicy,
  RootCauseType,
  SettlementPartyType,
} from './store-domain-quality-types.ts'
import {
  getQualityDeductionCaseFactByBasisId,
  getQualityDeductionCaseFactByQcId,
  getQualityDeductionCaseFactByRouteKey,
  getQualityDeductionCaseStatusByQcId,
  listQualityDeductionCaseFacts,
  listQualityDeductionDeductionBases,
  listQualityDeductionSettlementAdjustments,
} from './quality-deduction-repository.ts'
import { syncQualityDeductionLifecycle } from './quality-deduction-lifecycle.ts'
import type {
  DeductionBasisFact,
  DisputeCaseFact,
  FactoryResponseFact,
  QualityDeductionBasisStatus,
  QualityDeductionCaseFact,
  QualityDeductionCaseStatus,
  QualityDeductionDisputeStatus,
  QualityDeductionFactoryResponseStatus,
  QualityDeductionLiabilityStatus,
  QualityDeductionQcResult,
  QualityDeductionSettlementAdjustmentWritebackStatus,
  QualityDeductionSettlementAdjustmentType,
  QualityDeductionSettlementImpactStatus,
  QcRecordFact,
  SettlementAdjustmentFact,
} from './quality-deduction-domain.ts'

export const QUALITY_DEDUCTION_QC_RESULT_LABEL: Record<QualityDeductionQcResult, string> = {
  QUALIFIED: '合格',
  PARTIALLY_QUALIFIED: '部分合格',
  UNQUALIFIED: '不合格',
}

export const QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL: Record<
  QualityDeductionFactoryResponseStatus,
  string
> = {
  NOT_REQUIRED: '无需工厂响应',
  PENDING_RESPONSE: '待工厂响应',
  CONFIRMED: '工厂已确认',
  AUTO_CONFIRMED: '超时自动确认',
  DISPUTED: '工厂已发起异议',
}

export const QUALITY_DEDUCTION_FACTORY_RESPONSE_ACTION_LABEL: Record<'CONFIRM' | 'DISPUTE' | 'AUTO_CONFIRM', string> = {
  CONFIRM: '确认处理',
  DISPUTE: '发起异议',
  AUTO_CONFIRM: '系统自动确认',
}

export const QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL: Record<QualityDeductionDisputeStatus, string> = {
  NONE: '无异议',
  PENDING_REVIEW: '待平台审核',
  IN_REVIEW: '平台处理中',
  UPHELD: '维持原判',
  PARTIALLY_ADJUSTED: '部分调整',
  REVERSED: '改判冲回',
  CLOSED: '已关闭',
}

export const QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL: Record<QualityDeductionLiabilityStatus, string> = {
  PENDING: '待判定',
  FACTORY: '工厂责任',
  NON_FACTORY: '非工厂责任',
  MIXED: '混合责任',
}

export const QUALITY_DEDUCTION_BASIS_STATUS_LABEL: Record<QualityDeductionBasisStatus, string> = {
  NOT_GENERATED: '未生成',
  GENERATED: '已生成',
  EFFECTIVE: '已生效',
  ADJUSTED: '已调整',
  CANCELLED: '已取消',
}

export const QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL: Record<
  QualityDeductionSettlementImpactStatus,
  string
> = {
  NO_IMPACT: '不影响',
  BLOCKED: '冻结中',
  ELIGIBLE: '可结算',
  INCLUDED_IN_STATEMENT: '已纳入结算单',
  SETTLED: '已结算',
  NEXT_CYCLE_ADJUSTMENT_PENDING: '待下周期调整',
}

export const QUALITY_DEDUCTION_CASE_STATUS_LABEL: Record<QualityDeductionCaseStatus, string> = {
  NO_ACTION: '无后续动作',
  WAIT_FACTORY_RESPONSE: '待工厂响应',
  WAIT_PLATFORM_REVIEW: '待平台处理',
  AUTO_CONFIRMED_PENDING_SETTLEMENT: '自动确认待结算',
  ADJUDICATED_PENDING_SETTLEMENT: '裁决回写待结算',
  READY_FOR_SETTLEMENT: '待进入结算',
  SETTLED: '已结算',
  ADJUSTMENT_PENDING: '待下周期调整',
  CLOSED: '已关闭',
}

export const QUALITY_DEDUCTION_SETTLEMENT_ADJUSTMENT_TYPE_LABEL: Record<
  QualityDeductionSettlementAdjustmentType,
  string
> = {
  INCREASE_DEDUCTION: '增加扣款',
  DECREASE_DEDUCTION: '减少扣款',
  REVERSAL: '冲回',
}

export const QUALITY_DEDUCTION_SETTLEMENT_ADJUSTMENT_WRITEBACK_STATUS_LABEL: Record<
  QualityDeductionSettlementAdjustmentWritebackStatus,
  string
> = {
  NOT_WRITTEN: '未写回',
  PENDING_WRITEBACK: '待写回',
  WRITTEN: '已写回',
}

export type PlatformQcDisplayResult = 'PASS' | 'PARTIAL_PASS' | 'FAIL'
export type PlatformQcWorkbenchViewKey =
  | 'ALL'
  | 'WAIT_FACTORY_RESPONSE'
  | 'AUTO_CONFIRMED'
  | 'DISPUTING'
  | 'WAIT_PLATFORM_REVIEW'
  | 'CLOSED'

export const PLATFORM_QC_WORKBENCH_VIEW_LABEL: Record<PlatformQcWorkbenchViewKey, string> = {
  ALL: '全部',
  WAIT_FACTORY_RESPONSE: '待工厂响应',
  AUTO_CONFIRMED: '已自动确认',
  DISPUTING: '异议中',
  WAIT_PLATFORM_REVIEW: '待平台处理',
  CLOSED: '已结案',
}

export interface PlatformQcListItem {
  qc: QualityInspection
  qcId: string
  qcNo: string
  isReturnInbound: boolean
  isLegacy: boolean
  batchId: string
  productionOrderId: string
  sourceTaskId: string
  processType: ReturnInboundProcessType
  processLabel: string
  qcPolicy: ReturnInboundQcPolicy
  returnFactoryId: string
  returnFactoryName: string
  warehouseId: string
  warehouseName: string
  inboundAt: string
  inboundBy: string
  sewPostProcessMode?: string
  sourceBusinessType: string
  sourceBusinessId: string
  inspector: string
  qcResult: QualityDeductionQcResult
  qcResultLabel: string
  result: PlatformQcDisplayResult
  status: QcStatus
  liabilityStatus: QualityDeductionLiabilityStatus
  liabilityStatusLabel: string
  factoryLiabilityQty: number
  nonFactoryLiabilityQty: number
  disposition?: QcDisposition
  affectedQty?: number
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  qualifiedRate: number
  unqualifiedRate: number
  inspectedAt: string
  factoryResponseStatus: QualityDeductionFactoryResponseStatus
  factoryResponseStatusLabel: string
  responseDeadlineAt?: string
  respondedAt?: string
  autoConfirmedAt?: string
  responderUserName?: string
  responseComment?: string
  isResponseOverdue: boolean
  requiresFactoryResponse: boolean
  disputeStatus: QualityDeductionDisputeStatus
  disputeStatusLabel: string
  disputeId?: string
  caseStatus: QualityDeductionCaseStatus
  caseStatusLabel: string
  basisId?: string
  deductionBasisStatus: QualityDeductionBasisStatus
  deductionBasisStatusLabel: string
  blockedProcessingFeeAmount: number
  proposedQualityDeductionAmount: number
  effectiveQualityDeductionAmount: number
  evidenceCount: number
  canViewDeduction: boolean
  canHandleDispute: boolean
  hasDispute: boolean
  settlementImpactStatus: QualityDeductionSettlementImpactStatus
  settlementImpactStatusLabel: string
  settlementImpactSummary: string
  candidateSettlementCycleId?: string
  includedSettlementStatementId?: string
  includedSettlementBatchId?: string
  settlementReady: boolean
}

export interface PlatformQcWorkbenchStats {
  totalCount: number
  waitFactoryResponseCount: number
  autoConfirmedCount: number
  disputingCount: number
  waitPlatformReviewCount: number
  blockedCount: number
  readyForSettlementCount: number
  blockedOrReadyCount: number
  closedCount: number
}

export interface PlatformQcDetailViewModel {
  qcId: string
  qcNo: string
  routeAliases: string[]
  isLegacy: boolean
  sourceTypeLabel: string
  qcRecord: QcRecordFact
  factoryResponse: FactoryResponseFact | null
  deductionBasis: DeductionBasisFact | null
  disputeCase: DisputeCaseFact | null
  settlementImpact: QualityDeductionCaseFact['settlementImpact']
  settlementAdjustment: SettlementAdjustmentFact | null
  caseStatus: QualityDeductionCaseStatus
  caseStatusLabel: string
  qcResultDisplay: PlatformQcDisplayResult
  qcResultLabel: string
  qcStatusLabel: string
  liabilityStatusLabel: string
  factoryResponseStatusLabel: string
  disputeStatusLabel: string
  deductionBasisStatusLabel: string
  settlementImpactStatusLabel: string
  qcPolicyLabel: string
  qualifiedRate: number
  unqualifiedRate: number
  warehouseEvidenceCount: number
  disputeEvidenceCount: number
  basisEvidenceCount: number
  canViewDeduction: boolean
  canHandleDispute: boolean
  requiresFactoryResponse: boolean
  showUnqualifiedHandling: boolean
  settlementReady: boolean
}

export interface FutureMobileFactoryQcListItem {
  qcId: string
  qcNo: string
  productionOrderNo: string
  returnInboundBatchNo: string
  qcResult: QualityDeductionQcResult
  qcResultLabel: string
  processLabel: string
  returnFactoryName: string
  warehouseName: string
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  factoryLiabilityQty: number
  inspectedAt: string
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  settlementImpactStatus: QualityDeductionSettlementImpactStatus
  settlementImpactStatusLabel: string
  responseDeadlineAt?: string
  factoryResponseStatus: QualityDeductionFactoryResponseStatus
  factoryResponseStatusLabel: string
  disputeStatus: QualityDeductionDisputeStatus
  disputeStatusLabel: string
  caseStatus: QualityDeductionCaseStatus
  caseStatusLabel: string
  isOverdue: boolean
  canConfirm: boolean
  canDispute: boolean
}

export interface FutureMobileFactoryQcBuckets {
  pending: FutureMobileFactoryQcListItem[]
  disputing: FutureMobileFactoryQcListItem[]
  processed: FutureMobileFactoryQcListItem[]
  history: FutureMobileFactoryQcListItem[]
}

export interface FutureMobileFactoryQcDetail {
  qcId: string
  qcNo: string
  productionOrderNo: string
  returnInboundBatchNo: string
  sourceTypeLabel: string
  processLabel: string
  returnFactoryName: string
  warehouseName: string
  qcPolicyLabel: string
  qcResult: QualityDeductionQcResult
  qcResultLabel: string
  inspectorUserName: string
  inspectedAt: string
  remark?: string
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  liabilityStatus: QualityDeductionLiabilityStatus
  liabilityStatusLabel: string
  warehouseEvidenceAssets: QcRecordFact['evidenceAssets']
  warehouseEvidenceCount: number
  defectItems: QcRecordFact['defectItems']
  unqualifiedReasonSummary?: string
  factoryLiabilityQty: number
  nonFactoryLiabilityQty: number
  responsibilitySummary: string
  blockedProcessingFeeAmount: number
  effectiveQualityDeductionAmount: number
  settlementImpactStatus: QualityDeductionSettlementImpactStatus
  settlementImpactStatusLabel: string
  settlementSummary: string
  blockedSettlementQty: number
  candidateSettlementCycleId?: string
  includedSettlementStatementId?: string
  includedSettlementBatchId?: string
  settlementAdjustmentSummary?: string
  responseDeadlineAt?: string
  factoryResponseStatus: QualityDeductionFactoryResponseStatus
  factoryResponseStatusLabel: string
  respondedAt?: string
  autoConfirmedAt?: string
  responderUserName?: string
  responseAction?: 'CONFIRM' | 'DISPUTE' | 'AUTO_CONFIRM'
  responseActionLabel?: string
  responseComment?: string
  isOverdue: boolean
  requiresFactoryResponse: boolean
  disputeStatus: QualityDeductionDisputeStatus
  disputeStatusLabel: string
  disputeId?: string
  disputeReasonName?: string
  disputeDescription?: string
  availableActions: Array<'CONFIRM' | 'DISPUTE'>
  submittedDisputeEvidenceAssets: DisputeCaseFact['disputeEvidenceAssets']
  submittedAt?: string
  submittedByUserName?: string
  reviewerUserName?: string
  adjudicatedAt?: string
  adjudicationComment?: string
  adjudicationResultLabel?: string
  resultWrittenBackAt?: string
  platformAdjudicationSummary: string
}

export interface FutureMobileFactoryQcSummary {
  pendingCount: number
  soonOverdueCount: number
  disputingCount: number
  processedCount: number
  historyCount: number
}

export interface FutureSettlementAdjustmentListItem {
  adjustmentId: string
  adjustmentNo: string
  qcId: string
  qcNo: string
  productionOrderNo: string
  basisId: string
  disputeId: string
  adjustmentType: QualityDeductionSettlementAdjustmentType
  adjustmentTypeLabel: string
  adjustmentQty: number
  adjustmentAmount: number
  targetSettlementCycleId: string
  writebackStatus: SettlementAdjustmentFact['writebackStatus']
  writebackStatusLabel: string
  generatedAt: string
  writtenBackAt?: string
  summary: string
}

function ensureQualityDeductionLifecycle(): void {
  syncQualityDeductionLifecycle()
}

function mapQcResultToDisplayResult(result: QualityDeductionQcResult): PlatformQcDisplayResult {
  if (result === 'QUALIFIED') return 'PASS'
  if (result === 'PARTIALLY_QUALIFIED') return 'PARTIAL_PASS'
  return 'FAIL'
}

function mapQcResultToLegacyResult(result: QualityDeductionQcResult): QualityInspection['result'] {
  return result === 'QUALIFIED' ? 'PASS' : 'FAIL'
}

function mapLiabilityStatusToLegacy(status: QualityDeductionLiabilityStatus): QualityInspection['liabilityStatus'] {
  return status as unknown as QualityInspection['liabilityStatus']
}

function mapDeductionBasisStatusToLegacy(status: QualityDeductionBasisStatus): DeductionBasisStatus {
  switch (status) {
    case 'GENERATED':
      return 'DRAFT'
    case 'EFFECTIVE':
    case 'ADJUSTED':
      return 'CONFIRMED'
    case 'CANCELLED':
      return 'VOID'
    default:
      return 'DRAFT'
  }
}

function mapDisputeStatusToLegacy(status: QualityDeductionDisputeStatus): 'OPEN' | 'REJECTED' | 'ADJUSTED' | 'ARCHIVED' {
  switch (status) {
    case 'UPHELD':
      return 'REJECTED'
    case 'PARTIALLY_ADJUSTED':
      return 'ADJUSTED'
    case 'REVERSED':
    case 'CLOSED':
      return 'ARCHIVED'
    default:
      return 'OPEN'
  }
}

function mapSettlementImpactStatusToLegacy(
  status: QualityDeductionSettlementImpactStatus,
): 'NO_IMPACT' | 'FROZEN' | 'READY' | 'SETTLED' | 'PENDING_ARBITRATION' {
  switch (status) {
    case 'BLOCKED':
      return 'FROZEN'
    case 'ELIGIBLE':
    case 'INCLUDED_IN_STATEMENT':
      return 'READY'
    case 'SETTLED':
      return 'SETTLED'
    case 'NEXT_CYCLE_ADJUSTMENT_PENDING':
      return 'PENDING_ARBITRATION'
    default:
      return 'NO_IMPACT'
  }
}

function sumRates(qualifiedQty: number, unqualifiedQty: number): { qualifiedRate: number; unqualifiedRate: number } {
  const total = qualifiedQty + unqualifiedQty
  if (total <= 0) return { qualifiedRate: 0, unqualifiedRate: 0 }
  return {
    qualifiedRate: Math.round((qualifiedQty / total) * 1000) / 10,
    unqualifiedRate: Math.round((unqualifiedQty / total) * 1000) / 10,
  }
}

export function toCompatibilityQualityInspection(caseFact: QualityDeductionCaseFact): QualityInspection {
  const { qcRecord, deductionBasis, disputeCase, settlementImpact } = caseFact

  return {
    qcId: qcRecord.qcId,
    refType: qcRecord.refType,
    refId: qcRecord.refId,
    refTaskId: qcRecord.refTaskId,
    productionOrderId: qcRecord.productionOrderNo,
    inspector: qcRecord.inspectorUserName,
    inspectedAt: qcRecord.inspectedAt,
    result: mapQcResultToLegacyResult(qcRecord.qcResult),
    inspectedQty: qcRecord.inspectedQty,
    qualifiedQty: qcRecord.qualifiedQty,
    unqualifiedQty: qcRecord.unqualifiedQty,
    defectItems: qcRecord.defectItems,
    remark: qcRecord.remark,
    status: qcRecord.qcStatus,
    disposition: qcRecord.unqualifiedDisposition,
    affectedQty: qcRecord.unqualifiedQty || undefined,
    rootCauseType: qcRecord.rootCauseType,
    responsiblePartyType: qcRecord.responsiblePartyType,
    responsiblePartyId: qcRecord.responsiblePartyId,
    responsiblePartyName: qcRecord.responsiblePartyName,
    liabilityStatus: mapLiabilityStatusToLegacy(qcRecord.liabilityStatus),
    liabilityDecisionStage: qcRecord.processType === 'SEW' ? 'SEW_RETURN_INBOUND_FINAL' : 'GENERAL',
    liabilityDecisionRequired: qcRecord.processType === 'SEW' && qcRecord.qcResult !== 'QUALIFIED',
    deductionDecision: qcRecord.deductionDecision,
    deductionAmount: deductionBasis?.effectiveQualityDeductionAmount,
    deductionCurrency: qcRecord.deductionDecision === 'DEDUCT' ? 'CNY' : undefined,
    deductionDecisionRemark: qcRecord.deductionDecisionRemark,
    liabilityDecidedAt: qcRecord.liabilityDecidedAt,
    liabilityDecidedBy: qcRecord.liabilityDecidedBy,
    disputeRemark: disputeCase?.disputeDescription,
    arbitrationResult:
      disputeCase?.status === 'PARTIALLY_ADJUSTED'
        ? 'REASSIGN'
        : disputeCase?.status === 'REVERSED'
          ? 'VOID_DEDUCTION'
          : disputeCase?.status === 'UPHELD'
            ? 'UPHOLD'
            : undefined,
    arbitrationRemark: disputeCase?.adjudicationComment,
    arbitratedAt: disputeCase?.adjudicatedAt,
    arbitratedBy: disputeCase?.reviewerUserName,
    dispositionRemark: qcRecord.dispositionRemark,
    closedAt: qcRecord.closedAt,
    closedBy: qcRecord.closedBy,
    sourceProcessType: qcRecord.processType,
    sourceOrderId: qcRecord.sourceOrderId,
    sourceReturnId: qcRecord.returnInboundBatchNo,
    inspectionScene: 'RETURN_INBOUND',
    returnBatchId: qcRecord.returnInboundBatchNo,
    returnProcessType: qcRecord.processType,
    qcPolicy: qcRecord.qcPolicy,
    returnFactoryId: qcRecord.returnFactoryId,
    returnFactoryName: qcRecord.returnFactoryName,
    warehouseId: qcRecord.warehouseId,
    warehouseName: qcRecord.warehouseName,
    sourceBusinessType: qcRecord.sourceBusinessType,
    sourceBusinessId: qcRecord.sourceBusinessId,
    sewPostProcessMode: qcRecord.sewPostProcessMode as QualityInspection['sewPostProcessMode'],
    writebackAvailableQty: qcRecord.writebackAvailableQty,
    writebackAcceptedAsDefectQty: qcRecord.writebackAcceptedAsDefectQty,
    writebackScrapQty: qcRecord.writebackScrapQty,
    writebackCompletedAt: qcRecord.writebackCompletedAt,
    writebackCompletedBy: qcRecord.writebackCompletedBy,
    downstreamUnblocked: qcRecord.downstreamUnblocked,
    settlementFreezeReason:
      settlementImpact.status === 'NO_IMPACT' || settlementImpact.status === 'ELIGIBLE' || settlementImpact.status === 'SETTLED'
        ? ''
        : settlementImpact.summary,
    auditLogs: qcRecord.auditLogs,
    createdAt: qcRecord.createdAt,
    updatedAt: qcRecord.updatedAt,
  }
}

export function toCompatibilityDeductionBasisItem(
  caseFact: QualityDeductionCaseFact,
): DeductionBasisItem | null {
  const { qcRecord, deductionBasis, disputeCase } = caseFact
  if (!deductionBasis) return null

  return {
    basisId: deductionBasis.basisId,
    sourceType: deductionBasis.sourceType,
    sourceRefId: qcRecord.qcId,
    sourceId: qcRecord.qcId,
    productionOrderId: deductionBasis.productionOrderNo,
    taskId: deductionBasis.taskId,
    factoryId: qcRecord.returnFactoryId ?? deductionBasis.settlementPartyId ?? '',
    settlementPartyType: deductionBasis.settlementPartyType,
    settlementPartyId: deductionBasis.settlementPartyId,
    rootCauseType: deductionBasis.rootCauseType,
    reasonCode: 'QUALITY_FAIL',
    qty: qcRecord.unqualifiedQty,
    deductionQty: deductionBasis.deductionQty,
    uom: 'PIECE',
    disposition: deductionBasis.unqualifiedDisposition,
    summary: deductionBasis.summary,
    evidenceRefs: deductionBasis.evidenceAssets.map((item) => ({
      name: item.name,
      type: item.assetType === 'IMAGE' ? '图片' : item.assetType === 'VIDEO' ? '视频' : '文档',
      url: item.url,
    })),
    status: mapDeductionBasisStatusToLegacy(deductionBasis.status),
    deepLinks: {
      qcHref: `/fcs/quality/qc-records/${qcRecord.qcId}`,
      taskHref: deductionBasis.taskId ? `/fcs/pda/task-receive/${deductionBasis.taskId}` : undefined,
    },
    sourceProcessType: qcRecord.processType,
    sourceOrderId: qcRecord.sourceOrderId,
    sourceReturnId: qcRecord.returnInboundBatchNo,
    sourceBatchId: qcRecord.returnInboundBatchNo,
    sourceBusinessType: qcRecord.sourceBusinessType,
    sourceBusinessId: qcRecord.sourceBusinessId,
    qcPolicySnapshot: qcRecord.qcPolicy,
    decisionStage: qcRecord.processType === 'SEW' ? 'SEW_RETURN_INBOUND_FINAL' : 'GENERAL',
    responsiblePartyTypeSnapshot: qcRecord.responsiblePartyType,
    responsiblePartyIdSnapshot: qcRecord.responsiblePartyId,
    responsiblePartyNameSnapshot: qcRecord.responsiblePartyName,
    dispositionSnapshot: deductionBasis.unqualifiedDisposition,
    deductionDecisionSnapshot: qcRecord.deductionDecision,
    deductionAmountSnapshot: deductionBasis.effectiveQualityDeductionAmount,
    settlementReady:
      caseFact.settlementImpact.status === 'ELIGIBLE' ||
      caseFact.settlementImpact.status === 'INCLUDED_IN_STATEMENT' ||
      caseFact.settlementImpact.status === 'SETTLED',
    settlementFreezeReason:
      caseFact.settlementImpact.status === 'BLOCKED' ||
      caseFact.settlementImpact.status === 'NEXT_CYCLE_ADJUSTMENT_PENDING'
        ? caseFact.settlementImpact.summary
        : '',
    qcStatusSnapshot: qcRecord.qcStatus,
    liabilityStatusSnapshot:
      qcRecord.liabilityStatus === 'PENDING'
        ? 'PENDING'
        : disputeCase &&
            (disputeCase.status === 'PENDING_REVIEW' || disputeCase.status === 'IN_REVIEW')
          ? 'DISPUTED'
          : 'CONFIRMED',
    deductionAmountEditable: deductionBasis.status === 'EFFECTIVE' || deductionBasis.status === 'ADJUSTED',
    arbitrationResult:
      disputeCase?.status === 'PARTIALLY_ADJUSTED'
        ? 'REASSIGN'
        : disputeCase?.status === 'REVERSED'
          ? 'VOID_DEDUCTION'
          : disputeCase?.status === 'UPHELD'
            ? 'UPHOLD'
            : undefined,
    arbitrationRemark: disputeCase?.adjudicationComment,
    arbitratedAt: disputeCase?.adjudicatedAt,
    arbitratedBy: disputeCase?.reviewerUserName,
    createdAt: deductionBasis.createdAt,
    createdBy: deductionBasis.createdBy,
    updatedAt: deductionBasis.updatedAt,
    updatedBy: deductionBasis.updatedBy,
    auditLogs: deductionBasis.auditLogs,
  }
}

function getCaseStatus(caseFact: QualityDeductionCaseFact): QualityDeductionCaseStatus {
  return getQualityDeductionCaseStatusByQcId(caseFact.qcRecord.qcId) ?? 'NO_ACTION'
}

function getFactoryResponseStatus(caseFact: QualityDeductionCaseFact): QualityDeductionFactoryResponseStatus {
  return caseFact.factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'
}

function getDisputeStatus(caseFact: QualityDeductionCaseFact): QualityDeductionDisputeStatus {
  return caseFact.disputeCase?.status ?? 'NONE'
}

function getDeductionBasisStatus(caseFact: QualityDeductionCaseFact): QualityDeductionBasisStatus {
  return caseFact.deductionBasis?.status ?? 'NOT_GENERATED'
}

function isSettlementReady(status: QualityDeductionSettlementImpactStatus): boolean {
  return status === 'ELIGIBLE' || status === 'INCLUDED_IN_STATEMENT' || status === 'SETTLED'
}

function getQcPolicyLabel(policy: ReturnInboundQcPolicy): string {
  return policy === 'REQUIRED' ? '必检' : policy === 'OPTIONAL' ? '可选抽检' : policy
}

function getDisputeAdjudicationLabel(disputeCase: DisputeCaseFact | null): string | undefined {
  if (!disputeCase) return undefined
  switch (disputeCase.adjudicationResult ?? disputeCase.status) {
    case 'UPHELD':
      return '维持原判'
    case 'PARTIALLY_ADJUSTED':
      return '部分调整'
    case 'REVERSED':
      return '改判冲回'
    case 'CLOSED':
      return '已关闭'
    case 'PENDING_REVIEW':
    case 'IN_REVIEW':
      return '待平台处理'
    default:
      return undefined
  }
}

function getResponsibilitySummary(caseFact: QualityDeductionCaseFact): string {
  const { qcRecord } = caseFact
  if (qcRecord.liabilityStatus === 'NON_FACTORY') {
    return `当前不计入工厂责任，非工厂责任数量 ${qcRecord.nonFactoryLiabilityQty} 件。`
  }
  if (qcRecord.liabilityStatus === 'MIXED') {
    return `当前判定混合责任，工厂责任 ${qcRecord.factoryLiabilityQty} 件，非工厂责任 ${qcRecord.nonFactoryLiabilityQty} 件。`
  }
  if (qcRecord.liabilityStatus === 'FACTORY') {
    return `当前判定工厂责任 ${qcRecord.factoryLiabilityQty} 件。`
  }
  return '当前责任判定尚未完成。'
}

function getFutureMobileAvailableActions(caseFact: QualityDeductionCaseFact): Array<'CONFIRM' | 'DISPUTE'> {
  const factoryResponseStatus = caseFact.factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'
  if (factoryResponseStatus !== 'PENDING_RESPONSE') return []
  if (caseFact.qcRecord.factoryLiabilityQty <= 0) return []
  return ['CONFIRM', 'DISPUTE']
}

function isSoonOverdue(deadline?: string, now: Date = new Date()): boolean {
  if (!deadline) return false
  const deadlineMs = new Date(deadline.replace(' ', 'T')).getTime()
  if (!Number.isFinite(deadlineMs)) return false
  const diff = deadlineMs - now.getTime()
  return diff >= 0 && diff <= 48 * 3600 * 1000
}

export function listPlatformQcListItems(options: { includeLegacy?: boolean } = {}): PlatformQcListItem[] {
  ensureQualityDeductionLifecycle()
  return listQualityDeductionCaseFacts(options)
    .map((caseFact) => {
      const qc = toCompatibilityQualityInspection(caseFact)
      const { qcRecord, settlementImpact, deductionBasis, factoryResponse, disputeCase } = caseFact
      const { qualifiedRate, unqualifiedRate } = sumRates(qcRecord.qualifiedQty, qcRecord.unqualifiedQty)
      const caseStatus = getCaseStatus(caseFact)
      const factoryResponseStatus = getFactoryResponseStatus(caseFact)
      const disputeStatus = getDisputeStatus(caseFact)
      const deductionBasisStatus = getDeductionBasisStatus(caseFact)

      return {
        qc,
        qcId: qcRecord.qcId,
        qcNo: qcRecord.qcNo,
        isReturnInbound: true,
        isLegacy: qcRecord.isLegacy,
        batchId: qcRecord.returnInboundBatchNo,
        productionOrderId: qcRecord.productionOrderNo,
        sourceTaskId: qcRecord.taskId ?? '',
        processType: qcRecord.processType,
        processLabel: qcRecord.processLabel,
        qcPolicy: qcRecord.qcPolicy,
        returnFactoryId: qcRecord.returnFactoryId ?? '',
        returnFactoryName: qcRecord.returnFactoryName ?? '-',
        warehouseId: qcRecord.warehouseId ?? '',
        warehouseName: qcRecord.warehouseName ?? '-',
        inboundAt: qcRecord.inboundAt ?? '-',
        inboundBy: qcRecord.inboundBy ?? '-',
        sewPostProcessMode: qcRecord.sewPostProcessMode,
        sourceBusinessType: qcRecord.sourceBusinessType ?? 'OTHER',
        sourceBusinessId: qcRecord.sourceBusinessId ?? '',
        inspector: qcRecord.inspectorUserName,
        qcResult: qcRecord.qcResult,
        qcResultLabel: QUALITY_DEDUCTION_QC_RESULT_LABEL[qcRecord.qcResult],
        result: mapQcResultToDisplayResult(qcRecord.qcResult),
        status: qcRecord.qcStatus,
        liabilityStatus: qcRecord.liabilityStatus,
        liabilityStatusLabel: QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL[qcRecord.liabilityStatus],
        factoryLiabilityQty: qcRecord.factoryLiabilityQty,
        nonFactoryLiabilityQty: qcRecord.nonFactoryLiabilityQty,
        disposition: qcRecord.unqualifiedDisposition,
        affectedQty: qcRecord.unqualifiedQty || undefined,
        inspectedQty: qcRecord.inspectedQty,
        qualifiedQty: qcRecord.qualifiedQty,
        unqualifiedQty: qcRecord.unqualifiedQty,
        qualifiedRate,
        unqualifiedRate,
        inspectedAt: qcRecord.inspectedAt,
        factoryResponseStatus,
        factoryResponseStatusLabel: QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[factoryResponseStatus],
        responseDeadlineAt: factoryResponse?.responseDeadlineAt,
        respondedAt: factoryResponse?.respondedAt,
        autoConfirmedAt: factoryResponse?.autoConfirmedAt,
        responderUserName: factoryResponse?.responderUserName,
        responseComment: factoryResponse?.responseComment,
        isResponseOverdue: factoryResponse?.isOverdue ?? false,
        requiresFactoryResponse: factoryResponseStatus !== 'NOT_REQUIRED',
        disputeStatus,
        disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[disputeStatus],
        disputeId: disputeCase?.disputeId,
        caseStatus,
        caseStatusLabel: QUALITY_DEDUCTION_CASE_STATUS_LABEL[caseStatus],
        basisId: deductionBasis?.basisId,
        deductionBasisStatus,
        deductionBasisStatusLabel: QUALITY_DEDUCTION_BASIS_STATUS_LABEL[deductionBasisStatus],
        blockedProcessingFeeAmount: settlementImpact.blockedProcessingFeeAmount,
        proposedQualityDeductionAmount: deductionBasis?.proposedQualityDeductionAmount ?? 0,
        effectiveQualityDeductionAmount: deductionBasis?.effectiveQualityDeductionAmount ?? settlementImpact.effectiveQualityDeductionAmount,
        evidenceCount: qcRecord.evidenceAssets.length,
        canViewDeduction: Boolean(deductionBasis?.basisId),
        canHandleDispute: disputeStatus === 'PENDING_REVIEW' || disputeStatus === 'IN_REVIEW',
        hasDispute: disputeStatus !== 'NONE',
        settlementImpactStatus: settlementImpact.status,
        settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
        settlementImpactSummary: settlementImpact.summary,
        candidateSettlementCycleId: settlementImpact.candidateSettlementCycleId,
        includedSettlementStatementId: settlementImpact.includedSettlementStatementId,
        includedSettlementBatchId: settlementImpact.includedSettlementBatchId,
        settlementReady: isSettlementReady(settlementImpact.status),
      }
    })
    .sort((left, right) => {
      return new Date(right.inspectedAt.replace(' ', 'T')).getTime() - new Date(left.inspectedAt.replace(' ', 'T')).getTime()
    })
}

export function matchesPlatformQcWorkbenchView(
  item: PlatformQcListItem,
  view: PlatformQcWorkbenchViewKey,
): boolean {
  switch (view) {
    case 'WAIT_FACTORY_RESPONSE':
      return item.factoryResponseStatus === 'PENDING_RESPONSE'
    case 'AUTO_CONFIRMED':
      return item.factoryResponseStatus === 'AUTO_CONFIRMED'
    case 'DISPUTING':
      return item.disputeStatus !== 'NONE' && item.disputeStatus !== 'CLOSED'
    case 'WAIT_PLATFORM_REVIEW':
      return item.caseStatus === 'WAIT_PLATFORM_REVIEW'
    case 'CLOSED':
      return item.caseStatus === 'CLOSED' || item.caseStatus === 'SETTLED' || item.status === 'CLOSED'
    default:
      return true
  }
}

export function getPlatformQcWorkbenchStats(options: { includeLegacy?: boolean } = {}): PlatformQcWorkbenchStats {
  ensureQualityDeductionLifecycle()
  const rows = listPlatformQcListItems(options)
  const blockedCount = rows.filter((item) => item.settlementImpactStatus === 'BLOCKED').length
  const readyForSettlementCount = rows.filter((item) =>
    item.settlementImpactStatus === 'ELIGIBLE' || item.settlementImpactStatus === 'INCLUDED_IN_STATEMENT',
  ).length

  return {
    totalCount: rows.length,
    waitFactoryResponseCount: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'WAIT_FACTORY_RESPONSE')).length,
    autoConfirmedCount: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'AUTO_CONFIRMED')).length,
    disputingCount: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'DISPUTING')).length,
    waitPlatformReviewCount: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'WAIT_PLATFORM_REVIEW')).length,
    blockedCount,
    readyForSettlementCount,
    blockedOrReadyCount: blockedCount + readyForSettlementCount,
    closedCount: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'CLOSED')).length,
  }
}

export function getPlatformQcWorkbenchTabCounts(
  options: { includeLegacy?: boolean } = {},
): Record<PlatformQcWorkbenchViewKey, number> {
  ensureQualityDeductionLifecycle()
  const rows = listPlatformQcListItems(options)
  return {
    ALL: rows.length,
    WAIT_FACTORY_RESPONSE: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'WAIT_FACTORY_RESPONSE')).length,
    AUTO_CONFIRMED: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'AUTO_CONFIRMED')).length,
    DISPUTING: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'DISPUTING')).length,
    WAIT_PLATFORM_REVIEW: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'WAIT_PLATFORM_REVIEW')).length,
    CLOSED: rows.filter((item) => matchesPlatformQcWorkbenchView(item, 'CLOSED')).length,
  }
}

export function getPlatformQcListItemByQcId(qcId: string): PlatformQcListItem | null {
  ensureQualityDeductionLifecycle()
  return listPlatformQcListItems({ includeLegacy: true }).find((item) => item.qcId === qcId) ?? null
}

export function getPlatformQcDetailViewModelByRouteKey(routeKey: string): PlatformQcDetailViewModel | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByRouteKey(routeKey)
  if (!caseFact) return null

  const { qcRecord, factoryResponse, deductionBasis, disputeCase, settlementImpact, settlementAdjustment } = caseFact
  const { qualifiedRate, unqualifiedRate } = sumRates(qcRecord.qualifiedQty, qcRecord.unqualifiedQty)
  const caseStatus = getCaseStatus(caseFact)
  const factoryResponseStatus = getFactoryResponseStatus(caseFact)
  const disputeStatus = getDisputeStatus(caseFact)
  const deductionBasisStatus = getDeductionBasisStatus(caseFact)

  return {
    qcId: qcRecord.qcId,
    qcNo: qcRecord.qcNo,
    routeAliases: qcRecord.routeAliases,
    isLegacy: qcRecord.isLegacy,
    sourceTypeLabel: qcRecord.sourceTypeLabel,
    qcRecord,
    factoryResponse,
    deductionBasis,
    disputeCase,
    settlementImpact,
    settlementAdjustment,
    caseStatus,
    caseStatusLabel: QUALITY_DEDUCTION_CASE_STATUS_LABEL[caseStatus],
    qcResultDisplay: mapQcResultToDisplayResult(qcRecord.qcResult),
    qcResultLabel: QUALITY_DEDUCTION_QC_RESULT_LABEL[qcRecord.qcResult],
    qcStatusLabel: qcRecord.qcStatus === 'DRAFT' ? '草稿' : qcRecord.qcStatus === 'SUBMITTED' ? '已提交' : '已结案',
    liabilityStatusLabel: QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL[qcRecord.liabilityStatus],
    factoryResponseStatusLabel: QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[factoryResponseStatus],
    disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[disputeStatus],
    deductionBasisStatusLabel: QUALITY_DEDUCTION_BASIS_STATUS_LABEL[deductionBasisStatus],
    settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
    qcPolicyLabel:
      qcRecord.qcPolicy === 'REQUIRED'
        ? '必检'
        : qcRecord.qcPolicy === 'OPTIONAL'
          ? '可选抽检'
          : qcRecord.qcPolicy,
    qualifiedRate,
    unqualifiedRate,
    warehouseEvidenceCount: qcRecord.evidenceAssets.length,
    disputeEvidenceCount: disputeCase?.disputeEvidenceAssets.length ?? 0,
    basisEvidenceCount: deductionBasis?.evidenceAssets.length ?? 0,
    canViewDeduction: Boolean(deductionBasis?.basisId),
    canHandleDispute: disputeStatus === 'PENDING_REVIEW' || disputeStatus === 'IN_REVIEW',
    requiresFactoryResponse: factoryResponseStatus !== 'NOT_REQUIRED',
    showUnqualifiedHandling: qcRecord.qcResult !== 'QUALIFIED',
    settlementReady: isSettlementReady(settlementImpact.status),
  }
}

export function getPlatformQcDetailViewModelByQcId(qcId: string): PlatformQcDetailViewModel | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  return caseFact ? getPlatformQcDetailViewModelByRouteKey(caseFact.qcRecord.qcId) : null
}

export function getPlatformQcCompatInspectionByQcId(qcId: string): QualityInspection | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  return caseFact ? toCompatibilityQualityInspection(caseFact) : null
}

export function getPlatformQcCompatInspectionByRouteKey(routeKey: string): QualityInspection | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByRouteKey(routeKey)
  return caseFact ? toCompatibilityQualityInspection(caseFact) : null
}

export function listPlatformQcCompatInspections(options: { includeLegacy?: boolean } = {}): QualityInspection[] {
  ensureQualityDeductionLifecycle()
  return listQualityDeductionCaseFacts(options).map((item) => toCompatibilityQualityInspection(item))
}

export function listDeductionBasisCompatItems(options: { includeLegacy?: boolean } = {}): DeductionBasisItem[] {
  ensureQualityDeductionLifecycle()
  return listQualityDeductionCaseFacts(options)
    .map((item) => toCompatibilityDeductionBasisItem(item))
    .filter((item): item is DeductionBasisItem => item !== null)
}

export function getDeductionBasisCompatItemById(basisId: string): DeductionBasisItem | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByBasisId(basisId)
  return caseFact ? toCompatibilityDeductionBasisItem(caseFact) : null
}

export interface PdaSettlementWritebackItem {
  basisId: string
  qcId: string
  productionOrderId: string
  taskId?: string
  batchId?: string
  processLabel: string
  warehouseName: string
  returnFactoryName: string
  summary: string
  liabilityStatusText: string
  settlementStatusText: string
  deductionQty: number
  deductionAmountCny: number
  blockedProcessingFeeAmount: number
  inspectedAt: string
}

export function listPdaSettlementWritebackItems(factoryKeys: Set<string>): PdaSettlementWritebackItem[] {
  ensureQualityDeductionLifecycle()
  return listQualityDeductionCaseFacts({ includeLegacy: false })
    .filter((caseFact) => caseFact.deductionBasis)
    .filter((caseFact) => {
      const qc = caseFact.qcRecord
      return Boolean(qc.returnFactoryId && factoryKeys.has(qc.returnFactoryId))
    })
    .map((caseFact) => {
      const { qcRecord, deductionBasis, settlementImpact, disputeCase } = caseFact
      const settlementStatusText =
        settlementImpact.status === 'SETTLED'
          ? `已结算 · ${settlementImpact.includedSettlementBatchId ?? ''}`.trim()
          : QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status]

      return {
        basisId: deductionBasis!.basisId,
        qcId: qcRecord.qcId,
        productionOrderId: qcRecord.productionOrderNo,
        taskId: qcRecord.taskId,
        batchId: qcRecord.returnInboundBatchNo,
        processLabel: qcRecord.processLabel,
        warehouseName: qcRecord.warehouseName ?? '-',
        returnFactoryName: qcRecord.returnFactoryName ?? '-',
        summary: deductionBasis!.summary,
        liabilityStatusText:
          disputeCase?.status === 'PARTIALLY_ADJUSTED'
            ? '改判生效'
            : disputeCase?.status === 'UPHELD'
              ? '争议驳回'
              : disputeCase?.status === 'PENDING_REVIEW' || disputeCase?.status === 'IN_REVIEW'
                ? '争议中'
                : QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL[qcRecord.liabilityStatus],
        settlementStatusText,
        deductionQty: deductionBasis!.deductionQty,
        deductionAmountCny: settlementImpact.effectiveQualityDeductionAmount,
        blockedProcessingFeeAmount: settlementImpact.blockedProcessingFeeAmount,
        inspectedAt: qcRecord.inspectedAt,
      }
    })
    .sort((left, right) => new Date(right.inspectedAt.replace(' ', 'T')).getTime() - new Date(left.inspectedAt.replace(' ', 'T')).getTime())
}

function toFutureMobileListItem(caseFact: QualityDeductionCaseFact): FutureMobileFactoryQcListItem {
  const { qcRecord, factoryResponse, disputeCase, settlementImpact } = caseFact
  const availableActions = getFutureMobileAvailableActions(caseFact)
  const caseStatus = getCaseStatus(caseFact)
  return {
    qcId: qcRecord.qcId,
    qcNo: qcRecord.qcNo,
    productionOrderNo: qcRecord.productionOrderNo,
    returnInboundBatchNo: qcRecord.returnInboundBatchNo,
    qcResult: qcRecord.qcResult,
    qcResultLabel: QUALITY_DEDUCTION_QC_RESULT_LABEL[qcRecord.qcResult],
    processLabel: qcRecord.processLabel,
    returnFactoryName: qcRecord.returnFactoryName ?? '-',
    warehouseName: qcRecord.warehouseName ?? '-',
    inspectedQty: qcRecord.inspectedQty,
    qualifiedQty: qcRecord.qualifiedQty,
    unqualifiedQty: qcRecord.unqualifiedQty,
    factoryLiabilityQty: qcRecord.factoryLiabilityQty,
    inspectedAt: qcRecord.inspectedAt,
    blockedProcessingFeeAmount: settlementImpact.blockedProcessingFeeAmount,
    effectiveQualityDeductionAmount: settlementImpact.effectiveQualityDeductionAmount,
    settlementImpactStatus: settlementImpact.status,
    settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
    responseDeadlineAt: factoryResponse?.responseDeadlineAt,
    factoryResponseStatus: factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED',
    factoryResponseStatusLabel:
      QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'],
    disputeStatus: disputeCase?.status ?? 'NONE',
    disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[disputeCase?.status ?? 'NONE'],
    caseStatus,
    caseStatusLabel: QUALITY_DEDUCTION_CASE_STATUS_LABEL[caseStatus],
    isOverdue: factoryResponse?.isOverdue ?? false,
    canConfirm: availableActions.includes('CONFIRM'),
    canDispute: availableActions.includes('DISPUTE'),
  }
}

export function listFutureMobileFactoryQcBuckets(factoryId: string): FutureMobileFactoryQcBuckets {
  ensureQualityDeductionLifecycle()
  const base = listQualityDeductionCaseFacts({ includeLegacy: true }).filter((item) => item.qcRecord.returnFactoryId === factoryId)
  const buckets: FutureMobileFactoryQcBuckets = { pending: [], disputing: [], processed: [], history: [] }

  for (const caseFact of base) {
    const item = toFutureMobileListItem(caseFact)
    const caseStatus = getCaseStatus(caseFact)
    if (caseStatus === 'WAIT_FACTORY_RESPONSE') {
      buckets.pending.push(item)
      continue
    }
    if (caseStatus === 'WAIT_PLATFORM_REVIEW') {
      buckets.disputing.push(item)
      continue
    }
    if (caseFact.qcRecord.isLegacy || caseStatus === 'SETTLED' || caseStatus === 'CLOSED') {
      buckets.history.push(item)
      continue
    }
    buckets.processed.push(item)
  }

  return buckets
}

export function getFutureMobileFactoryQcSummary(factoryId: string): FutureMobileFactoryQcSummary {
  ensureQualityDeductionLifecycle()
  const buckets = listFutureMobileFactoryQcBuckets(factoryId)
  return {
    pendingCount: buckets.pending.length,
    soonOverdueCount: buckets.pending.filter((item) => isSoonOverdue(item.responseDeadlineAt) && !item.isOverdue).length,
    disputingCount: buckets.disputing.length,
    processedCount: buckets.processed.length,
    historyCount: buckets.history.length,
  }
}

export function getFutureMobileFactoryQcDetail(
  qcId: string,
  factoryId?: string,
): FutureMobileFactoryQcDetail | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  if (!caseFact) return null
  if (factoryId && caseFact.qcRecord.returnFactoryId !== factoryId) return null

  const { qcRecord, factoryResponse, disputeCase, settlementImpact } = caseFact
  const availableActions = getFutureMobileAvailableActions(caseFact)

  return {
    qcId: qcRecord.qcId,
    qcNo: qcRecord.qcNo,
    productionOrderNo: qcRecord.productionOrderNo,
    returnInboundBatchNo: qcRecord.returnInboundBatchNo,
    sourceTypeLabel: qcRecord.sourceTypeLabel,
    processLabel: qcRecord.processLabel,
    returnFactoryName: qcRecord.returnFactoryName ?? '-',
    warehouseName: qcRecord.warehouseName ?? '-',
    qcPolicyLabel: getQcPolicyLabel(qcRecord.qcPolicy),
    qcResult: qcRecord.qcResult,
    qcResultLabel: QUALITY_DEDUCTION_QC_RESULT_LABEL[qcRecord.qcResult],
    inspectorUserName: qcRecord.inspectorUserName,
    inspectedAt: qcRecord.inspectedAt,
    remark: qcRecord.remark,
    inspectedQty: qcRecord.inspectedQty,
    qualifiedQty: qcRecord.qualifiedQty,
    unqualifiedQty: qcRecord.unqualifiedQty,
    liabilityStatus: qcRecord.liabilityStatus,
    liabilityStatusLabel: QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL[qcRecord.liabilityStatus],
    warehouseEvidenceAssets: qcRecord.evidenceAssets,
    warehouseEvidenceCount: qcRecord.evidenceAssets.length,
    defectItems: qcRecord.defectItems,
    unqualifiedReasonSummary: qcRecord.unqualifiedReasonSummary,
    factoryLiabilityQty: qcRecord.factoryLiabilityQty,
    nonFactoryLiabilityQty: qcRecord.nonFactoryLiabilityQty,
    responsibilitySummary: getResponsibilitySummary(caseFact),
    blockedProcessingFeeAmount: settlementImpact.blockedProcessingFeeAmount,
    effectiveQualityDeductionAmount: settlementImpact.effectiveQualityDeductionAmount,
    settlementImpactStatus: settlementImpact.status,
    settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
    settlementSummary: settlementImpact.summary,
    blockedSettlementQty: settlementImpact.blockedSettlementQty,
    candidateSettlementCycleId: settlementImpact.candidateSettlementCycleId,
    includedSettlementStatementId: settlementImpact.includedSettlementStatementId,
    includedSettlementBatchId: settlementImpact.includedSettlementBatchId,
    settlementAdjustmentSummary: caseFact.settlementAdjustment?.summary,
    responseDeadlineAt: factoryResponse?.responseDeadlineAt,
    factoryResponseStatus: factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED',
    factoryResponseStatusLabel:
      QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'],
    respondedAt: factoryResponse?.respondedAt,
    autoConfirmedAt: factoryResponse?.autoConfirmedAt,
    responderUserName: factoryResponse?.responderUserName,
    responseAction: factoryResponse?.responseAction,
    responseActionLabel: factoryResponse?.responseAction
      ? QUALITY_DEDUCTION_FACTORY_RESPONSE_ACTION_LABEL[factoryResponse.responseAction]
      : undefined,
    responseComment: factoryResponse?.responseComment,
    isOverdue: factoryResponse?.isOverdue ?? false,
    requiresFactoryResponse: (factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED') !== 'NOT_REQUIRED',
    disputeStatus: disputeCase?.status ?? 'NONE',
    disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[disputeCase?.status ?? 'NONE'],
    disputeId: disputeCase?.disputeId,
    disputeReasonName: disputeCase?.disputeReasonName,
    disputeDescription: disputeCase?.disputeDescription,
    availableActions,
    submittedDisputeEvidenceAssets: disputeCase?.disputeEvidenceAssets ?? [],
    submittedAt: disputeCase?.submittedAt,
    submittedByUserName: disputeCase?.submittedByUserName,
    reviewerUserName: disputeCase?.reviewerUserName,
    adjudicatedAt: disputeCase?.adjudicatedAt,
    adjudicationComment: disputeCase?.adjudicationComment,
    adjudicationResultLabel: getDisputeAdjudicationLabel(disputeCase ?? null),
    resultWrittenBackAt: disputeCase?.resultWrittenBackAt ?? caseFact.settlementAdjustment?.writtenBackAt,
    platformAdjudicationSummary:
      disputeCase?.adjustmentReasonSummary ??
      disputeCase?.adjudicationComment ??
      disputeCase?.disputeDescription ??
      settlementImpact.summary,
  }
}

export function listFutureSettlementAdjustmentItems(options: {
  includeLegacy?: boolean
} = {}): FutureSettlementAdjustmentListItem[] {
  ensureQualityDeductionLifecycle()
  return listQualityDeductionSettlementAdjustments(options)
    .map((adjustment) => {
      const caseFact = getQualityDeductionCaseFactByQcId(adjustment.qcId)
      if (!caseFact) return null
      return {
        adjustmentId: adjustment.adjustmentId,
        adjustmentNo: adjustment.adjustmentNo,
        qcId: adjustment.qcId,
        qcNo: caseFact.qcRecord.qcNo,
        productionOrderNo: caseFact.qcRecord.productionOrderNo,
        basisId: adjustment.basisId,
        disputeId: adjustment.disputeId,
        adjustmentType: adjustment.adjustmentType,
        adjustmentTypeLabel: QUALITY_DEDUCTION_SETTLEMENT_ADJUSTMENT_TYPE_LABEL[adjustment.adjustmentType],
        adjustmentQty: adjustment.adjustmentQty,
        adjustmentAmount: adjustment.adjustmentAmount,
        targetSettlementCycleId: adjustment.targetSettlementCycleId,
        writebackStatus: adjustment.writebackStatus,
        writebackStatusLabel:
          QUALITY_DEDUCTION_SETTLEMENT_ADJUSTMENT_WRITEBACK_STATUS_LABEL[adjustment.writebackStatus],
        generatedAt: adjustment.generatedAt,
        writtenBackAt: adjustment.writtenBackAt,
        summary: adjustment.summary,
      }
    })
    .filter((item): item is FutureSettlementAdjustmentListItem => item !== null)
}

export interface CompatChainDispute {
  disputeId: string
  qcId: string
  basisId: string
  factoryId?: string
  status: 'OPEN' | 'REJECTED' | 'ADJUSTED' | 'ARCHIVED'
  summary: string
  submittedAt?: string
  submittedBy?: string
  resolvedAt?: string
  resolvedBy?: string
  requestedAmount?: number
  finalAmount?: number
}

export interface CompatChainSettlementImpact {
  qcId: string
  basisId?: string
  factoryId?: string
  batchId: string
  status: 'NO_IMPACT' | 'FROZEN' | 'READY' | 'SETTLED' | 'PENDING_ARBITRATION'
  summary: string
  settlementBatchId?: string
  settledAt?: string
}

export interface CompatQcChainFact {
  qc: QualityInspection
  basisItems: DeductionBasisItem[]
  dispute: CompatChainDispute | null
  settlementImpact: CompatChainSettlementImpact
  evidenceCount: number
  deductionAmountCny: number
  factoryResponse: FactoryResponseFact | null
  deductionBasis: DeductionBasisFact | null
  disputeCase: DisputeCaseFact | null
  settlementAdjustment: SettlementAdjustmentFact | null
  caseStatus: QualityDeductionCaseStatus
}

export function toCompatQcChainFact(caseFact: QualityDeductionCaseFact): CompatQcChainFact {
  const basisItem = toCompatibilityDeductionBasisItem(caseFact)
  const basisItems = basisItem ? [basisItem] : []
  const dispute = caseFact.disputeCase
    ? {
        disputeId: caseFact.disputeCase.disputeId,
        qcId: caseFact.disputeCase.qcId,
        basisId: caseFact.disputeCase.basisId,
        factoryId: caseFact.qcRecord.returnFactoryId,
        status: mapDisputeStatusToLegacy(caseFact.disputeCase.status),
        summary:
          caseFact.disputeCase.status === 'PARTIALLY_ADJUSTED'
            ? `争议成立，扣款金额改判为 ${caseFact.disputeCase.adjudicatedAmount ?? 0} CNY`
            : caseFact.disputeCase.disputeDescription,
        submittedAt: caseFact.disputeCase.submittedAt,
        submittedBy: caseFact.disputeCase.submittedByUserName,
        resolvedAt: caseFact.disputeCase.adjudicatedAt,
        resolvedBy: caseFact.disputeCase.reviewerUserName,
        requestedAmount: caseFact.disputeCase.requestedAmount,
        finalAmount: caseFact.disputeCase.adjudicatedAmount,
      }
    : null

  return {
    qc: toCompatibilityQualityInspection(caseFact),
    basisItems,
    dispute,
    settlementImpact: {
      qcId: caseFact.qcRecord.qcId,
      basisId: caseFact.deductionBasis?.basisId,
      factoryId: caseFact.qcRecord.returnFactoryId,
      batchId: caseFact.qcRecord.returnInboundBatchNo,
      status: mapSettlementImpactStatusToLegacy(caseFact.settlementImpact.status),
      summary: caseFact.settlementImpact.summary,
      settlementBatchId:
        caseFact.settlementImpact.includedSettlementBatchId ?? caseFact.settlementImpact.candidateSettlementCycleId,
      settledAt: caseFact.settlementImpact.settledAt,
    },
    evidenceCount: caseFact.qcRecord.evidenceAssets.length,
    deductionAmountCny: caseFact.deductionBasis?.effectiveQualityDeductionAmount ?? 0,
    factoryResponse: caseFact.factoryResponse,
    deductionBasis: caseFact.deductionBasis,
    disputeCase: caseFact.disputeCase,
    settlementAdjustment: caseFact.settlementAdjustment,
    caseStatus: getCaseStatus(caseFact),
  }
}
