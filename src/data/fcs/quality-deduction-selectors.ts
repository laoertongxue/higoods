import type {
  DeductionBasisItem,
  DeductionBasisSourceType,
  DeductionBasisStatus,
  InspectionMethod,
  QualityInspection,
  QcDisposition,
  QcStatus,
  ReturnInboundProcessType,
  ReturnInboundQcPolicy,
  RootCauseType,
  SettlementPartyType,
} from './store-domain-quality-types.ts'
import {
  getFormalQualityDeductionLedgerById,
  getQualityDeductionCaseFactByBasisId,
  getQualityDeductionCaseFactByQcId,
  getQualityDeductionCaseFactByRouteKey,
  listFormalQualityDeductionLedgers,
  listQualityDeductionCaseFacts,
} from './quality-deduction-repository.ts'
import { syncQualityDeductionLifecycle } from './quality-deduction-lifecycle.ts'
import {
  deriveQualityDeductionCaseStatus,
  type DeductionBasisFact,
  type DisputeCaseFact,
  type FactoryResponseFact,
  type FormalQualityDeductionLedgerFact,
  type PendingQualityDeductionRecord,
  type QualityDeductionBasisStatus,
  type QualityDeductionCaseFact,
  type QualityDeductionCaseStatus,
  type QualityDeductionDisputeStatus,
  type QualityDeductionFactoryResponseStatus,
  type QualityDeductionLiabilityStatus,
  type QualityDeductionQcResult,
  type QualityDeductionSettlementAdjustmentType,
  type QualityDeductionSettlementAdjustmentWritebackStatus,
  type QualityDeductionSettlementImpactStatus,
  type QcRecordFact,
  type SettlementAdjustmentFact,
  type SettlementImpactFact,
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
  NOT_REQUIRED: '无需工厂处理',
  PENDING_RESPONSE: '待工厂处理',
  CONFIRMED: '工厂已确认',
  AUTO_CONFIRMED: '系统自动确认',
  DISPUTED: '已发起质量异议',
}

export const QUALITY_DEDUCTION_FACTORY_RESPONSE_ACTION_LABEL: Record<
  'CONFIRM' | 'DISPUTE' | 'AUTO_CONFIRM',
  string
> = {
  CONFIRM: '确认处理',
  DISPUTE: '发起异议',
  AUTO_CONFIRM: '系统自动确认',
}

export const QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL: Record<QualityDeductionDisputeStatus, string> = {
  NONE: '未发起异议',
  PENDING_REVIEW: '待平台处理',
  IN_REVIEW: '平台处理中',
  UPHELD: '最终维持工厂责任',
  PARTIALLY_ADJUSTED: '最终部分工厂责任',
  REVERSED: '最终非工厂责任',
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
  GENERATED: '已生成待确认记录',
  EFFECTIVE: '已形成正式质量扣款流水',
  ADJUSTED: '已按裁决更新',
  CANCELLED: '已关闭且不生成流水',
}

export const QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL: Record<
  QualityDeductionSettlementImpactStatus,
  string
> = {
  NO_IMPACT: '未形成正式质量扣款流水',
  BLOCKED: '待确认或待平台处理',
  ELIGIBLE: '已生成正式质量扣款流水',
  INCLUDED_IN_STATEMENT: '已进入预结算单',
  SETTLED: '已进入预付款批次',
  NEXT_CYCLE_ADJUSTMENT_PENDING: '已关闭且不生成流水',
}

export const QUALITY_DEDUCTION_CASE_STATUS_LABEL: Record<QualityDeductionCaseStatus, string> = {
  NO_ACTION: '无后续动作',
  WAIT_FACTORY_RESPONSE: '待工厂处理',
  WAIT_PLATFORM_REVIEW: '待平台处理',
  AUTO_CONFIRMED_PENDING_SETTLEMENT: '系统自动确认，已形成正式流水',
  ADJUDICATED_PENDING_SETTLEMENT: '平台裁决后已形成正式流水',
  READY_FOR_SETTLEMENT: '已形成正式质量扣款流水',
  SETTLED: '已进入预付款批次',
  ADJUSTMENT_PENDING: '已关闭且不生成流水',
  CLOSED: '已关闭',
}

// 以下标签仅为历史兼容详情保留，不再驱动当前正式质量扣款主链。
export const QUALITY_DEDUCTION_SETTLEMENT_ADJUSTMENT_TYPE_LABEL: Record<
  QualityDeductionSettlementAdjustmentType,
  string
> = {
  INCREASE_DEDUCTION: '补记扣款',
  DECREASE_DEDUCTION: '差额重算',
  REVERSAL: '取消扣款',
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
  WAIT_FACTORY_RESPONSE: '待工厂处理',
  AUTO_CONFIRMED: '已自动确认',
  DISPUTING: '异议中',
  WAIT_PLATFORM_REVIEW: '待平台处理',
  CLOSED: '已关闭 / 已完成',
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
  pendingDeductionRecord: PendingQualityDeductionRecord | null
  deductionBasis: DeductionBasisFact | null
  disputeCase: DisputeCaseFact | null
  formalLedger: FormalQualityDeductionLedgerFact | null
  settlementImpact: SettlementImpactFact
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
  respondedAt?: string
  autoConfirmedAt?: string
  factoryResponseStatus: QualityDeductionFactoryResponseStatus
  factoryResponseStatusLabel: string
  disputeStatus: QualityDeductionDisputeStatus
  disputeStatusLabel: string
  submittedAt?: string
  adjudicatedAt?: string
  resultWrittenBackAt?: string
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
  inspectionSceneLabel?: string
  inspectionTypeLabel?: string
  inspectionMethodLabel?: string
  processLabel: string
  returnFactoryName: string
  receiverName: string
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
  declaredQty: number
  receivedQty: number
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
  pendingRecordStatusLabel?: string
  formalLedgerNo?: string
  formalLedgerStatusLabel?: string
}

export interface FutureMobileFactoryQcSummary {
  pendingCount: number
  soonOverdueCount: number
  disputingCount: number
  processedCount: number
  historyCount: number
  nearestPendingDeadlineAt?: string
  nearestSoonOverdueDeadlineAt?: string
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
  originalCurrency: string
  originalAmount: number
  settlementCurrency: string
  settlementAmount: number
  fxRate: number
  fxAppliedAt?: string
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
  pendingDeductionRecord: PendingQualityDeductionRecord | null
  deductionBasis: DeductionBasisFact | null
  disputeCase: DisputeCaseFact | null
  formalLedger: FormalQualityDeductionLedgerFact | null
  settlementAdjustment: SettlementAdjustmentFact | null
  caseStatus: QualityDeductionCaseStatus
}

function ensureQualityDeductionLifecycle(): void {
  syncQualityDeductionLifecycle()
}

function parseDateMs(value?: string): number | null {
  if (!value) return null
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function isOpenDisputeStatus(status?: QualityDeductionDisputeStatus | null): boolean {
  return status === 'PENDING_REVIEW' || status === 'IN_REVIEW'
}

function isSoonOverdue(deadline?: string): boolean {
  const deadlineMs = parseDateMs(deadline)
  if (deadlineMs === null) return false
  const diff = deadlineMs - Date.now()
  return diff > 0 && diff <= 24 * 60 * 60 * 1000
}

function getCaseStatus(caseFact: QualityDeductionCaseFact): QualityDeductionCaseStatus {
  return caseFact.caseStatus ?? deriveQualityDeductionCaseStatus(caseFact)
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

function getQcPolicyLabel(policy: ReturnInboundQcPolicy): string {
  if (policy === 'REQUIRED') return '必检'
  if (policy === 'OPTIONAL') return '抽检'
  return '免检'
}

function getInspectionMethodLabel(method?: InspectionMethod): string {
  if (method === 'COUNT_ONLY') return '数量复核'
  if (method === 'SAMPLING') return '抽检'
  if (method === 'FULL_INSPECTION') return '全检'
  return '未配置'
}

function getInspectionTypeLabel(type?: 'QC' | 'RECHECK'): string {
  return type === 'RECHECK' ? '复检' : '质检'
}

function getInspectionSceneLabel(scene?: string): string {
  if (scene === 'SEW_RETURN_RECEIVING_QC') return '回货质检'
  if (scene === 'POST_FINAL_RECHECK') return '后道复检'
  if (scene === 'PRINT_RECEIVING_QC') return '印花回货质检'
  if (scene === 'DYE_RECEIVING_QC') return '染色回货质检'
  if (scene === 'CUT_PIECE_RECEIVING_QC') return '裁片回货质检'
  return '回货质检'
}

function getQcStatusLabel(status: QcStatus): string {
  if (status === 'DRAFT') return '草稿'
  if (status === 'SUBMITTED') return '已提交'
  return '已关闭'
}

function getResponsibilitySummary(caseFact: QualityDeductionCaseFact): string {
  const { qcRecord, pendingDeductionRecord, disputeCase, formalLedger } = caseFact
  if (qcRecord.liabilityStatus === 'NON_FACTORY') return '当前批次判定为非工厂责任，不生成正式质量扣款流水。'
  if (qcRecord.liabilityStatus === 'FACTORY' || qcRecord.liabilityStatus === 'MIXED') {
    if (disputeCase && isOpenDisputeStatus(disputeCase.status)) {
      return '当前已生成质量异议单，待平台处理后再决定是否形成正式质量扣款流水。'
    }
    if (formalLedger) {
      return '当前批次已形成正式质量扣款流水，可继续进入预结算。'
    }
    if (pendingDeductionRecord) {
      return '当前批次已生成待确认质量扣款记录，等待工厂处理。'
    }
  }
  return '当前记录仅用于质检判断，尚未形成后续质量扣款对象。'
}

function getDisputeAdjudicationLabel(disputeCase: DisputeCaseFact | null): string | undefined {
  if (!disputeCase) return undefined
  if (disputeCase.adjudicationResult === 'UPHELD') return '最终维持工厂责任'
  if (disputeCase.adjudicationResult === 'PARTIALLY_ADJUSTED') return '最终部分工厂责任'
  if (disputeCase.adjudicationResult === 'REVERSED') return '最终非工厂责任'
  return undefined
}

function getLedgerStatusLabel(ledger: FormalQualityDeductionLedgerFact | null): string | undefined {
  if (!ledger) return undefined
  switch (ledger.status) {
    case 'GENERATED_PENDING_STATEMENT':
      return '已生成正式质量扣款流水'
    case 'INCLUDED_IN_STATEMENT':
      return '已进入预结算单'
    case 'INCLUDED_IN_PREPAYMENT_BATCH':
      return '已进入预付款批次'
    case 'PREPAID':
      return '已预付'
    case 'WAIT_FINAL_SETTLEMENT':
      return '待后续最终分账'
  }
}

function getPendingRecordStatusLabel(pending: PendingQualityDeductionRecord | null): string | undefined {
  if (!pending) return undefined
  switch (pending.status) {
    case 'PENDING_FACTORY_CONFIRM':
      return '待工厂处理'
    case 'FACTORY_CONFIRMED':
      return '工厂已确认'
    case 'SYSTEM_AUTO_CONFIRMED':
      return '系统自动确认'
    case 'DISPUTED':
      return '已发起质量异议'
    case 'CLOSED_WITHOUT_LEDGER':
      return '已关闭且不生成流水'
  }
}

function resolveSettlementSummary(caseFact: QualityDeductionCaseFact): string {
  const pending = caseFact.pendingDeductionRecord
  const dispute = caseFact.disputeCase
  const ledger = caseFact.formalLedger
  if (ledger) {
    return getLedgerStatusLabel(ledger) ?? '已形成正式质量扣款流水'
  }
  if (dispute && isOpenDisputeStatus(dispute.status)) {
    return '质量异议单待处理，当前不生成正式质量扣款流水。'
  }
  if (pending?.status === 'PENDING_FACTORY_CONFIRM') {
    return '已生成待确认质量扣款记录，等待工厂在 48 小时内处理。'
  }
  if (pending?.status === 'CLOSED_WITHOUT_LEDGER' || dispute?.adjudicationResult === 'REVERSED') {
    return '平台已判定不生成正式质量扣款流水。'
  }
  return caseFact.settlementImpact.summary
}

function resolveRequiresFactoryResponse(caseFact: QualityDeductionCaseFact): boolean {
  return Boolean(
    caseFact.pendingDeductionRecord ||
      (caseFact.factoryResponse && caseFact.factoryResponse.factoryResponseStatus !== 'NOT_REQUIRED'),
  )
}

function getFutureMobileAvailableActions(caseFact: QualityDeductionCaseFact): Array<'CONFIRM' | 'DISPUTE'> {
  const pending = caseFact.pendingDeductionRecord
  if (!pending) return []
  if (pending.status !== 'PENDING_FACTORY_CONFIRM') return []
  if (caseFact.formalLedger) return []
  if (caseFact.disputeCase && isOpenDisputeStatus(caseFact.disputeCase.status)) return []
  return ['CONFIRM', 'DISPUTE']
}

export function toCompatibilityQualityInspection(caseFact: QualityDeductionCaseFact): QualityInspection {
  const { qcRecord, deductionBasis, disputeCase, settlementImpact, formalLedger } = caseFact
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
    deductionAmount: formalLedger?.originalAmount ?? deductionBasis?.effectiveQualityDeductionAmount,
    deductionCurrency: 'CNY',
    deductionDecisionRemark: qcRecord.deductionDecisionRemark,
    liabilityDecidedAt: qcRecord.liabilityDecidedAt,
    liabilityDecidedBy: qcRecord.liabilityDecidedBy,
    disputeRemark: disputeCase?.disputeDescription,
    arbitrationResult:
      disputeCase?.adjudicationResult === 'PARTIALLY_ADJUSTED'
        ? 'REASSIGN'
        : disputeCase?.adjudicationResult === 'REVERSED'
          ? 'VOID_DEDUCTION'
          : disputeCase?.adjudicationResult === 'UPHELD'
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
    inspectionScene: qcRecord.inspectionScene ?? 'SEW_RETURN_RECEIVING_QC',
    inspectionType: qcRecord.inspectionType ?? 'QC',
    inspectionMethod: qcRecord.inspectionMethod,
    returnBatchId: qcRecord.returnInboundBatchNo,
    returnProcessType: qcRecord.processType,
    qcPolicy: qcRecord.qcPolicy,
    returnFactoryId: qcRecord.returnFactoryId,
    returnFactoryName: qcRecord.returnFactoryName,
    warehouseId: qcRecord.warehouseId,
    warehouseName: qcRecord.warehouseName,
    managedPostFactoryId: qcRecord.managedPostFactoryId,
    managedPostFactoryName: qcRecord.managedPostFactoryName,
    finishedWarehouseId: qcRecord.finishedWarehouseId,
    finishedWarehouseName: qcRecord.finishedWarehouseName,
    sourceBusinessType: qcRecord.sourceBusinessType,
    sourceBusinessId: qcRecord.sourceBusinessId,
    sewPostProcessMode: qcRecord.sewPostProcessMode as QualityInspection['sewPostProcessMode'],
    postExecutionMode: qcRecord.postExecutionMode as QualityInspection['postExecutionMode'],
    handoverOrderId: qcRecord.handoverOrderId,
    handoverRecordIds: qcRecord.handoverRecordIds,
    receiverKind: qcRecord.receiverKind,
    receiverId: qcRecord.receiverId,
    receiverName: qcRecord.receiverName,
    declaredQty: qcRecord.declaredQty,
    receivedQty: qcRecord.receivedQty,
    samplingQty: qcRecord.samplingQty,
    samplingRatio: qcRecord.samplingRatio,
    nextAction: qcRecord.nextAction,
    writebackAvailableQty: qcRecord.writebackAvailableQty,
    writebackAcceptedAsDefectQty: qcRecord.writebackAcceptedAsDefectQty,
    writebackScrapQty: qcRecord.writebackScrapQty,
    writebackCompletedAt: qcRecord.writebackCompletedAt,
    writebackCompletedBy: qcRecord.writebackCompletedBy,
    downstreamUnblocked: qcRecord.downstreamUnblocked,
    settlementFreezeReason:
      settlementImpact.status === 'NO_IMPACT' || settlementImpact.status === 'ELIGIBLE' || settlementImpact.status === 'SETTLED'
        ? ''
        : resolveSettlementSummary(caseFact),
    auditLogs: qcRecord.auditLogs,
    createdAt: qcRecord.createdAt,
    updatedAt: qcRecord.updatedAt,
  }
}

export function toCompatibilityDeductionBasisItem(caseFact: QualityDeductionCaseFact): DeductionBasisItem | null {
  const { qcRecord, deductionBasis, disputeCase, formalLedger } = caseFact
  if (!deductionBasis) return null
  return {
    basisId: deductionBasis.basisId,
    sourceType: deductionBasis.sourceType as DeductionBasisSourceType,
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
    deductionAmountSnapshot: formalLedger?.originalAmount ?? deductionBasis.effectiveQualityDeductionAmount,
    settlementReady: Boolean(formalLedger),
    settlementFreezeReason: formalLedger ? '' : resolveSettlementSummary(caseFact),
    qcStatusSnapshot: qcRecord.qcStatus,
    liabilityStatusSnapshot:
      caseFact.disputeCase && isOpenDisputeStatus(caseFact.disputeCase.status)
        ? 'DISPUTED'
        : formalLedger
          ? 'CONFIRMED'
          : 'PENDING',
    deductionAmountEditable: deductionBasis.status === 'EFFECTIVE' || deductionBasis.status === 'ADJUSTED',
    arbitrationResult:
      disputeCase?.adjudicationResult === 'PARTIALLY_ADJUSTED'
        ? 'REASSIGN'
        : disputeCase?.adjudicationResult === 'REVERSED'
          ? 'VOID_DEDUCTION'
          : disputeCase?.adjudicationResult === 'UPHELD'
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

function toPlatformListItem(caseFact: QualityDeductionCaseFact): PlatformQcListItem {
  const { qcRecord, factoryResponse, pendingDeductionRecord, deductionBasis, disputeCase, settlementImpact, formalLedger } =
    caseFact
  const rates = sumRates(qcRecord.qualifiedQty, qcRecord.unqualifiedQty)
  const factoryResponseStatus = factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'
  const disputeStatus = disputeCase?.status ?? 'NONE'
  const caseStatus = getCaseStatus(caseFact)
  return {
    qc: toCompatibilityQualityInspection(caseFact),
    qcId: qcRecord.qcId,
    qcNo: qcRecord.qcNo,
    isReturnInbound: qcRecord.refType === 'RETURN_BATCH',
    isLegacy: qcRecord.isLegacy,
    batchId: qcRecord.returnInboundBatchNo,
    productionOrderId: qcRecord.productionOrderNo,
    sourceTaskId: qcRecord.taskId ?? '',
    processType: qcRecord.processType,
    processLabel: qcRecord.processLabel,
    qcPolicy: qcRecord.qcPolicy,
    returnFactoryId: qcRecord.returnFactoryId ?? '',
    returnFactoryName: qcRecord.returnFactoryName ?? '—',
    warehouseId: qcRecord.warehouseId ?? '',
    warehouseName: qcRecord.warehouseName ?? '—',
    inboundAt: qcRecord.inboundAt ?? '',
    inboundBy: qcRecord.inboundBy ?? '',
    sewPostProcessMode: qcRecord.sewPostProcessMode,
    sourceBusinessType: qcRecord.sourceBusinessType ?? '',
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
    qualifiedRate: rates.qualifiedRate,
    unqualifiedRate: rates.unqualifiedRate,
    inspectedAt: qcRecord.inspectedAt,
    factoryResponseStatus,
    factoryResponseStatusLabel: QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[factoryResponseStatus],
    responseDeadlineAt: factoryResponse?.responseDeadlineAt,
    respondedAt: factoryResponse?.respondedAt,
    autoConfirmedAt: factoryResponse?.autoConfirmedAt,
    responderUserName: factoryResponse?.responderUserName,
    responseComment: factoryResponse?.responseComment,
    isResponseOverdue: factoryResponse?.isOverdue ?? pendingDeductionRecord?.isOverdue ?? false,
    requiresFactoryResponse: resolveRequiresFactoryResponse(caseFact),
    disputeStatus,
    disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[disputeStatus],
    disputeId: disputeCase?.disputeId,
    caseStatus,
    caseStatusLabel: QUALITY_DEDUCTION_CASE_STATUS_LABEL[caseStatus],
    basisId: deductionBasis?.basisId,
    deductionBasisStatus: deductionBasis?.status ?? 'NOT_GENERATED',
    deductionBasisStatusLabel: QUALITY_DEDUCTION_BASIS_STATUS_LABEL[deductionBasis?.status ?? 'NOT_GENERATED'],
    blockedProcessingFeeAmount: settlementImpact.blockedProcessingFeeAmount,
    proposedQualityDeductionAmount: pendingDeductionRecord?.originalAmount ?? deductionBasis?.proposedQualityDeductionAmount ?? 0,
    effectiveQualityDeductionAmount: formalLedger?.originalAmount ?? settlementImpact.effectiveQualityDeductionAmount,
    evidenceCount: qcRecord.evidenceAssets.length,
    canViewDeduction: Boolean(deductionBasis || formalLedger),
    canHandleDispute: Boolean(disputeCase && isOpenDisputeStatus(disputeStatus)),
    hasDispute: Boolean(disputeCase),
    settlementImpactStatus: settlementImpact.status,
    settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
    settlementImpactSummary: resolveSettlementSummary(caseFact),
    candidateSettlementCycleId: settlementImpact.candidateSettlementCycleId,
    includedSettlementStatementId: settlementImpact.includedSettlementStatementId,
    includedSettlementBatchId: settlementImpact.includedSettlementBatchId ?? formalLedger?.includedPrepaymentBatchId,
    settlementReady: Boolean(formalLedger),
  }
}

function sortPlatformRows<T extends { inspectedAt: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftTime = parseDateMs(left.inspectedAt) ?? 0
    const rightTime = parseDateMs(right.inspectedAt) ?? 0
    return rightTime - leftTime
  })
}

export function listPlatformQcListItems(options: { includeLegacy?: boolean } = {}): PlatformQcListItem[] {
  ensureQualityDeductionLifecycle()
  return sortPlatformRows(
    listQualityDeductionCaseFacts(options).map((caseFact) => toPlatformListItem(caseFact)),
  )
}

export function matchesPlatformQcWorkbenchView(
  row: PlatformQcListItem,
  view: PlatformQcWorkbenchViewKey,
): boolean {
  if (view === 'ALL') return true
  if (view === 'WAIT_FACTORY_RESPONSE') return row.factoryResponseStatus === 'PENDING_RESPONSE'
  if (view === 'AUTO_CONFIRMED') return row.factoryResponseStatus === 'AUTO_CONFIRMED'
  if (view === 'DISPUTING') return row.disputeStatus === 'PENDING_REVIEW' || row.disputeStatus === 'IN_REVIEW'
  if (view === 'WAIT_PLATFORM_REVIEW') return row.disputeStatus === 'PENDING_REVIEW'
  return (
    row.caseStatus === 'CLOSED' ||
    row.caseStatus === 'SETTLED' ||
    row.factoryResponseStatus === 'CONFIRMED' ||
    row.factoryResponseStatus === 'AUTO_CONFIRMED'
  )
}

export function getPlatformQcWorkbenchStats(options: { includeLegacy?: boolean } = {}): PlatformQcWorkbenchStats {
  const rows = listPlatformQcListItems(options)
  const waitFactoryResponseCount = rows.filter((row) => row.factoryResponseStatus === 'PENDING_RESPONSE').length
  const autoConfirmedCount = rows.filter((row) => row.factoryResponseStatus === 'AUTO_CONFIRMED').length
  const disputingCount = rows.filter((row) => row.disputeStatus === 'PENDING_REVIEW' || row.disputeStatus === 'IN_REVIEW').length
  const waitPlatformReviewCount = rows.filter((row) => row.disputeStatus === 'PENDING_REVIEW').length
  const blockedCount = rows.filter((row) => row.settlementImpactStatus === 'BLOCKED').length
  const readyForSettlementCount = rows.filter((row) => row.settlementReady).length
  const closedCount = rows.filter((row) => row.caseStatus === 'CLOSED' || row.caseStatus === 'SETTLED').length
  return {
    totalCount: rows.length,
    waitFactoryResponseCount,
    autoConfirmedCount,
    disputingCount,
    waitPlatformReviewCount,
    blockedCount,
    readyForSettlementCount,
    blockedOrReadyCount: blockedCount + readyForSettlementCount,
    closedCount,
  }
}

export function getPlatformQcWorkbenchTabCounts(
  options: { includeLegacy?: boolean } = {},
): Record<PlatformQcWorkbenchViewKey, number> {
  const rows = listPlatformQcListItems(options)
  return {
    ALL: rows.length,
    WAIT_FACTORY_RESPONSE: rows.filter((row) => matchesPlatformQcWorkbenchView(row, 'WAIT_FACTORY_RESPONSE')).length,
    AUTO_CONFIRMED: rows.filter((row) => matchesPlatformQcWorkbenchView(row, 'AUTO_CONFIRMED')).length,
    DISPUTING: rows.filter((row) => matchesPlatformQcWorkbenchView(row, 'DISPUTING')).length,
    WAIT_PLATFORM_REVIEW: rows.filter((row) => matchesPlatformQcWorkbenchView(row, 'WAIT_PLATFORM_REVIEW')).length,
    CLOSED: rows.filter((row) => matchesPlatformQcWorkbenchView(row, 'CLOSED')).length,
  }
}

export function getPlatformQcListItemByQcId(qcId: string): PlatformQcListItem | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  return caseFact ? toPlatformListItem(caseFact) : null
}

export function getPlatformQcDetailViewModelByRouteKey(routeKey: string): PlatformQcDetailViewModel | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByRouteKey(routeKey)
  if (!caseFact) return null
  const { qcRecord, factoryResponse, pendingDeductionRecord, deductionBasis, disputeCase, formalLedger, settlementImpact } =
    caseFact
  const rates = sumRates(qcRecord.qualifiedQty, qcRecord.unqualifiedQty)
  const caseStatus = getCaseStatus(caseFact)
  return {
    qcId: qcRecord.qcId,
    qcNo: qcRecord.qcNo,
    routeAliases: qcRecord.routeAliases,
    isLegacy: qcRecord.isLegacy,
    sourceTypeLabel: qcRecord.sourceTypeLabel,
    qcRecord,
    factoryResponse,
    pendingDeductionRecord,
    deductionBasis,
    disputeCase,
    formalLedger,
    settlementImpact,
    settlementAdjustment: null,
    caseStatus,
    caseStatusLabel: QUALITY_DEDUCTION_CASE_STATUS_LABEL[caseStatus],
    qcResultDisplay: mapQcResultToDisplayResult(qcRecord.qcResult),
    qcResultLabel: QUALITY_DEDUCTION_QC_RESULT_LABEL[qcRecord.qcResult],
    qcStatusLabel: getQcStatusLabel(qcRecord.qcStatus),
    liabilityStatusLabel: QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL[qcRecord.liabilityStatus],
    factoryResponseStatusLabel:
      QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'],
    disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[disputeCase?.status ?? 'NONE'],
    deductionBasisStatusLabel: QUALITY_DEDUCTION_BASIS_STATUS_LABEL[deductionBasis?.status ?? 'NOT_GENERATED'],
    settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
    qcPolicyLabel: getQcPolicyLabel(qcRecord.qcPolicy),
    qualifiedRate: rates.qualifiedRate,
    unqualifiedRate: rates.unqualifiedRate,
    warehouseEvidenceCount: qcRecord.evidenceAssets.length,
    disputeEvidenceCount: disputeCase?.disputeEvidenceAssets.length ?? 0,
    basisEvidenceCount: deductionBasis?.evidenceAssets.length ?? 0,
    canViewDeduction: Boolean(deductionBasis || formalLedger),
    canHandleDispute: Boolean(disputeCase && isOpenDisputeStatus(disputeCase.status)),
    requiresFactoryResponse: resolveRequiresFactoryResponse(caseFact),
    showUnqualifiedHandling: qcRecord.qcResult !== 'QUALIFIED',
    settlementReady: Boolean(formalLedger),
  }
}

export function getPlatformQcDetailViewModelByQcId(qcId: string): PlatformQcDetailViewModel | null {
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

export function listPdaSettlementWritebackItems(factoryKeys: Set<string>): PdaSettlementWritebackItem[] {
  ensureQualityDeductionLifecycle()
  return listQualityDeductionCaseFacts({ includeLegacy: false })
    .filter((caseFact) => {
      const factoryId = caseFact.qcRecord.returnFactoryId ?? caseFact.formalLedger?.factoryId
      return Boolean(caseFact.formalLedger && factoryId && factoryKeys.has(factoryId))
    })
    .map((caseFact) => {
      const ledger = caseFact.formalLedger!
      const basis = caseFact.deductionBasis
      return {
        basisId: basis?.basisId ?? ledger.ledgerId,
        qcId: caseFact.qcRecord.qcId,
        productionOrderId: caseFact.qcRecord.productionOrderNo,
        taskId: caseFact.qcRecord.taskId,
        batchId: caseFact.qcRecord.returnInboundBatchNo,
        processLabel: caseFact.qcRecord.processLabel,
        warehouseName: caseFact.qcRecord.warehouseName ?? '-',
        returnFactoryName: caseFact.qcRecord.returnFactoryName ?? '-',
        summary: ledger.comment ?? resolveSettlementSummary(caseFact),
        liabilityStatusText: caseFact.disputeCase?.adjudicationResult === 'PARTIALLY_ADJUSTED'
          ? '部分工厂责任'
          : caseFact.disputeCase?.adjudicationResult === 'UPHELD'
            ? '维持工厂责任'
            : QUALITY_DEDUCTION_LIABILITY_STATUS_LABEL[caseFact.qcRecord.liabilityStatus],
        settlementStatusText: getLedgerStatusLabel(ledger) ?? '已形成正式质量扣款流水',
        deductionQty: basis?.deductionQty ?? caseFact.qcRecord.factoryLiabilityQty,
        deductionAmountCny: ledger.originalAmount,
        blockedProcessingFeeAmount: caseFact.settlementImpact.blockedProcessingFeeAmount,
        inspectedAt: caseFact.qcRecord.inspectedAt,
        originalCurrency: ledger.originalCurrency,
        originalAmount: ledger.originalAmount,
        settlementCurrency: ledger.settlementCurrency,
        settlementAmount: ledger.settlementAmount,
        fxRate: ledger.fxRate ?? 1,
        fxAppliedAt: ledger.fxAppliedAt,
      }
    })
    .sort((left, right) => (parseDateMs(right.inspectedAt) ?? 0) - (parseDateMs(left.inspectedAt) ?? 0))
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
    effectiveQualityDeductionAmount: caseFact.formalLedger?.originalAmount ?? settlementImpact.effectiveQualityDeductionAmount,
    settlementImpactStatus: settlementImpact.status,
    settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
    responseDeadlineAt: factoryResponse?.responseDeadlineAt,
    respondedAt: factoryResponse?.respondedAt,
    autoConfirmedAt: factoryResponse?.autoConfirmedAt,
    factoryResponseStatus: factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED',
    factoryResponseStatusLabel:
      QUALITY_DEDUCTION_FACTORY_RESPONSE_STATUS_LABEL[factoryResponse?.factoryResponseStatus ?? 'NOT_REQUIRED'],
    disputeStatus: disputeCase?.status ?? 'NONE',
    disputeStatusLabel: QUALITY_DEDUCTION_DISPUTE_STATUS_LABEL[disputeCase?.status ?? 'NONE'],
    submittedAt: disputeCase?.submittedAt,
    adjudicatedAt: disputeCase?.adjudicatedAt,
    resultWrittenBackAt: disputeCase?.resultWrittenBackAt ?? caseFact.formalLedger?.generatedAt,
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
    if (caseFact.pendingDeductionRecord?.status === 'PENDING_FACTORY_CONFIRM') {
      buckets.pending.push(item)
      continue
    }
    if (caseFact.disputeCase && isOpenDisputeStatus(caseFact.disputeCase.status)) {
      buckets.disputing.push(item)
      continue
    }
    if (caseFact.qcRecord.isLegacy || caseFact.formalLedger?.status === 'PREPAID' || caseFact.qcRecord.qcStatus === 'CLOSED') {
      buckets.history.push(item)
      continue
    }
    buckets.processed.push(item)
  }
  return buckets
}

export function listFutureMobileFactorySoonOverdueQcItems(factoryId: string): FutureMobileFactoryQcListItem[] {
  ensureQualityDeductionLifecycle()
  return listFutureMobileFactoryQcBuckets(factoryId)
    .pending.filter((item) => isSoonOverdue(item.responseDeadlineAt) && !item.isOverdue)
    .sort((left, right) => (parseDateMs(left.responseDeadlineAt) ?? Number.MAX_SAFE_INTEGER) - (parseDateMs(right.responseDeadlineAt) ?? Number.MAX_SAFE_INTEGER))
}

export function getFutureMobileFactoryQcSummary(factoryId: string): FutureMobileFactoryQcSummary {
  ensureQualityDeductionLifecycle()
  const buckets = listFutureMobileFactoryQcBuckets(factoryId)
  const soonOverdueItems = listFutureMobileFactorySoonOverdueQcItems(factoryId)
  const pendingDeadlines = buckets.pending
    .map((item) => item.responseDeadlineAt)
    .filter((item): item is string => Boolean(item))
    .sort()
  return {
    pendingCount: buckets.pending.length,
    soonOverdueCount: soonOverdueItems.length,
    disputingCount: buckets.disputing.length,
    processedCount: buckets.processed.length,
    historyCount: buckets.history.length,
    nearestPendingDeadlineAt: pendingDeadlines[0],
    nearestSoonOverdueDeadlineAt: soonOverdueItems[0]?.responseDeadlineAt,
  }
}

export function getFutureMobileFactoryQcDetail(qcId: string, factoryId?: string): FutureMobileFactoryQcDetail | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  if (!caseFact) return null
  if (factoryId && caseFact.qcRecord.returnFactoryId !== factoryId) return null

  const { qcRecord, factoryResponse, pendingDeductionRecord, deductionBasis, disputeCase, formalLedger, settlementImpact } = caseFact
  const availableActions = getFutureMobileAvailableActions(caseFact)
  return {
    qcId: qcRecord.qcId,
    qcNo: qcRecord.qcNo,
    productionOrderNo: qcRecord.productionOrderNo,
    returnInboundBatchNo: qcRecord.returnInboundBatchNo,
    sourceTypeLabel: qcRecord.sourceTypeLabel,
    inspectionSceneLabel: getInspectionSceneLabel(qcRecord.inspectionScene),
    inspectionTypeLabel: getInspectionTypeLabel(qcRecord.inspectionType),
    inspectionMethodLabel: getInspectionMethodLabel(qcRecord.inspectionMethod),
    processLabel: qcRecord.processLabel,
    returnFactoryName: qcRecord.returnFactoryName ?? '-',
    receiverName: qcRecord.receiverName ?? qcRecord.warehouseName ?? '-',
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
    declaredQty: qcRecord.declaredQty ?? qcRecord.inspectedQty,
    receivedQty: qcRecord.receivedQty ?? qcRecord.inspectedQty,
    blockedProcessingFeeAmount: settlementImpact.blockedProcessingFeeAmount,
    effectiveQualityDeductionAmount: formalLedger?.originalAmount ?? settlementImpact.effectiveQualityDeductionAmount,
    settlementImpactStatus: settlementImpact.status,
    settlementImpactStatusLabel: QUALITY_DEDUCTION_SETTLEMENT_IMPACT_STATUS_LABEL[settlementImpact.status],
    settlementSummary: resolveSettlementSummary(caseFact),
    blockedSettlementQty: settlementImpact.blockedSettlementQty,
    candidateSettlementCycleId: settlementImpact.candidateSettlementCycleId,
    includedSettlementStatementId: settlementImpact.includedSettlementStatementId ?? formalLedger?.includedStatementId,
    includedSettlementBatchId: settlementImpact.includedSettlementBatchId ?? formalLedger?.includedPrepaymentBatchId,
    settlementAdjustmentSummary: formalLedger
      ? `正式质量扣款流水 ${formalLedger.ledgerNo} · ${getLedgerStatusLabel(formalLedger) ?? '已生成'}`
      : pendingDeductionRecord?.status === 'CLOSED_WITHOUT_LEDGER'
        ? '平台已判定当前记录不生成正式质量扣款流水。'
        : undefined,
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
    isOverdue: factoryResponse?.isOverdue ?? pendingDeductionRecord?.isOverdue ?? false,
    requiresFactoryResponse: resolveRequiresFactoryResponse(caseFact),
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
    resultWrittenBackAt: disputeCase?.resultWrittenBackAt ?? formalLedger?.generatedAt,
    platformAdjudicationSummary:
      disputeCase?.adjustmentReasonSummary ??
      disputeCase?.adjudicationComment ??
      resolveSettlementSummary(caseFact),
    pendingRecordStatusLabel: getPendingRecordStatusLabel(pendingDeductionRecord),
    formalLedgerNo: formalLedger?.ledgerNo,
    formalLedgerStatusLabel: getLedgerStatusLabel(formalLedger),
  }
}

export function listFutureSettlementAdjustmentItems(_options: { includeLegacy?: boolean } = {}): FutureSettlementAdjustmentListItem[] {
  ensureQualityDeductionLifecycle()
  return []
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
        summary: caseFact.disputeCase.disputeDescription,
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
      summary: resolveSettlementSummary(caseFact),
      settlementBatchId:
        caseFact.settlementImpact.includedSettlementBatchId ??
        caseFact.formalLedger?.includedPrepaymentBatchId ??
        caseFact.settlementImpact.candidateSettlementCycleId,
      settledAt: caseFact.settlementImpact.settledAt,
    },
    evidenceCount: caseFact.qcRecord.evidenceAssets.length,
    deductionAmountCny: caseFact.formalLedger?.originalAmount ?? caseFact.deductionBasis?.effectiveQualityDeductionAmount ?? 0,
    factoryResponse: caseFact.factoryResponse,
    pendingDeductionRecord: caseFact.pendingDeductionRecord,
    deductionBasis: caseFact.deductionBasis,
    disputeCase: caseFact.disputeCase,
    formalLedger: caseFact.formalLedger,
    settlementAdjustment: null,
    caseStatus: getCaseStatus(caseFact),
  }
}

export function getFormalLedgerCompatItem(ledgerId: string): PdaSettlementWritebackItem | null {
  ensureQualityDeductionLifecycle()
  const ledger = getFormalQualityDeductionLedgerById(ledgerId)
  if (!ledger) return null
  const caseFact = getQualityDeductionCaseFactByQcId(ledger.qcId)
  if (!caseFact) return null
  return listPdaSettlementWritebackItems(new Set([caseFact.qcRecord.returnFactoryId ?? ledger.factoryId ?? '']))
    .find((item) => item.qcId === ledger.qcId) ?? null
}
