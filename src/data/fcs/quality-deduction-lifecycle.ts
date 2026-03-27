import {
  qualityDeductionSharedCaseFacts,
  qualityDeductionSharedFormalLedgers,
  qualityDeductionSharedPendingDeductionRecords,
  qualityDeductionSharedSettlementAdjustments,
} from './quality-deduction-shared-facts.ts'
import type {
  FormalQualityDeductionLedgerFact,
  PendingQualityDeductionRecord,
  PendingQualityDeductionRecordStatus,
  QualityDeductionCaseFact,
  QualityDeductionCaseStatus,
  QualityDeductionDisputeAdjudicationInput,
  QualityDeductionLedgerGenerationTrigger,
  QualityDeductionLedgerStatus,
} from './quality-deduction-domain.ts'
import { deriveQualityDeductionCaseStatus } from './quality-deduction-domain.ts'

interface LifecycleResultOk {
  ok: true
  caseFact: QualityDeductionCaseFact
}

interface LifecycleResultError {
  ok: false
  message: string
}

const AUTO_CONFIRM_SYSTEM_USER = '系统自动确认'
let mockedNow: Date | null = null
let lifecycleSequence = 1

function nextLifecycleId(prefix: string): string {
  lifecycleSequence += 1
  return `${prefix}-${String(lifecycleSequence).padStart(4, '0')}`
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function getQualityDeductionNow(): Date {
  return mockedNow ? new Date(mockedNow.getTime()) : new Date()
}

export function setQualityDeductionNowForTest(input: Date | string): void {
  const value = input instanceof Date ? input : new Date(input.replace(' ', 'T'))
  mockedNow = Number.isFinite(value.getTime()) ? value : null
}

export function resetQualityDeductionNowForTest(): void {
  mockedNow = null
}

export function formatQualityDeductionTimestamp(date: Date = getQualityDeductionNow()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

export function parseQualityDeductionTimestamp(value?: string): number | null {
  if (!value) return null
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function roundAmount(value: number): number {
  return Math.round(value * 100) / 100
}

function getCaseFactByQcId(qcId: string): QualityDeductionCaseFact | null {
  return qualityDeductionSharedCaseFacts.find((item) => item.qcRecord.qcId === qcId) ?? null
}

function appendQcAuditLog(
  caseFact: QualityDeductionCaseFact,
  detail: string,
  by: string,
  at: string,
  action: string,
): void {
  caseFact.qcRecord.auditLogs = [
    ...caseFact.qcRecord.auditLogs,
    {
      id: nextLifecycleId(`AL-${sanitizeIdPart(caseFact.qcRecord.qcId)}`),
      action,
      detail,
      at,
      by,
    },
  ]
}

function appendBasisAuditLog(
  caseFact: QualityDeductionCaseFact,
  detail: string,
  by: string,
  at: string,
  action: string,
): void {
  if (!caseFact.deductionBasis) return
  caseFact.deductionBasis.auditLogs = [
    ...caseFact.deductionBasis.auditLogs,
    {
      id: nextLifecycleId(`AL-${sanitizeIdPart(caseFact.deductionBasis.basisId)}`),
      action,
      detail,
      at,
      by,
    },
  ]
}

function syncPendingRegistry(caseFact: QualityDeductionCaseFact): void {
  if (!caseFact.pendingDeductionRecord) return
  const index = qualityDeductionSharedPendingDeductionRecords.findIndex(
    (item) => item.pendingRecordId === caseFact.pendingDeductionRecord?.pendingRecordId,
  )
  if (index >= 0) {
    qualityDeductionSharedPendingDeductionRecords[index] = caseFact.pendingDeductionRecord
    return
  }
  qualityDeductionSharedPendingDeductionRecords.push(caseFact.pendingDeductionRecord)
}

function syncLedgerRegistry(caseFact: QualityDeductionCaseFact): void {
  if (!caseFact.formalLedger) return
  const index = qualityDeductionSharedFormalLedgers.findIndex((item) => item.ledgerId === caseFact.formalLedger?.ledgerId)
  if (index >= 0) {
    qualityDeductionSharedFormalLedgers[index] = caseFact.formalLedger
    return
  }
  qualityDeductionSharedFormalLedgers.push(caseFact.formalLedger)
}

function clearLedgerRegistry(caseFact: QualityDeductionCaseFact): void {
  if (!caseFact.formalLedger) return
  const next = qualityDeductionSharedFormalLedgers.filter((item) => item.ledgerId !== caseFact.formalLedger?.ledgerId)
  qualityDeductionSharedFormalLedgers.splice(0, qualityDeductionSharedFormalLedgers.length, ...next)
  caseFact.formalLedger = null
}

function clearAdjustmentCompat(caseFact: QualityDeductionCaseFact): void {
  if (!caseFact.settlementAdjustment) return
  const targetId = caseFact.settlementAdjustment.adjustmentId
  caseFact.settlementAdjustment = null
  const next = qualityDeductionSharedSettlementAdjustments.filter((item) => item.adjustmentId !== targetId)
  qualityDeductionSharedSettlementAdjustments.splice(0, qualityDeductionSharedSettlementAdjustments.length, ...next)
}

function resolveLedgerStatus(caseFact: QualityDeductionCaseFact): QualityDeductionLedgerStatus {
  if (caseFact.formalLedger?.status) return caseFact.formalLedger.status
  if (caseFact.settlementImpact.status === 'SETTLED') return 'PREPAID'
  if (caseFact.settlementImpact.includedSettlementBatchId) return 'INCLUDED_IN_PREPAYMENT_BATCH'
  if (caseFact.settlementImpact.includedSettlementStatementId) return 'INCLUDED_IN_STATEMENT'
  return 'GENERATED_PENDING_STATEMENT'
}

function resolveLedgerTrigger(caseFact: QualityDeductionCaseFact): QualityDeductionLedgerGenerationTrigger {
  if (caseFact.disputeCase?.adjudicationResult === 'PARTIALLY_ADJUSTED') return 'ADJUDICATION_PARTIAL_LIABILITY'
  if (caseFact.disputeCase?.adjudicationResult === 'UPHELD') return 'ADJUDICATION_FACTORY_LIABILITY'
  if (caseFact.pendingDeductionRecord?.status === 'SYSTEM_AUTO_CONFIRMED') return 'AUTO_CONFIRM'
  return 'FACTORY_CONFIRM'
}

function ensurePendingRecord(caseFact: QualityDeductionCaseFact, nextStatus: PendingQualityDeductionRecordStatus, at: string, by: string, comment?: string): PendingQualityDeductionRecord | null {
  const pending = caseFact.pendingDeductionRecord
  if (!pending) return null
  pending.status = nextStatus
  pending.handledAt = at
  pending.handledBy = by
  pending.handledComment = comment ?? pending.handledComment
  pending.isOverdue =
    Boolean(pending.responseDeadlineAt) &&
    Boolean(parseQualityDeductionTimestamp(pending.responseDeadlineAt) && parseQualityDeductionTimestamp(pending.responseDeadlineAt)! < parseQualityDeductionTimestamp(at)!)
  pending.updatedAt = at
  syncPendingRegistry(caseFact)
  return pending
}

function buildLedger(caseFact: QualityDeductionCaseFact, at: string, by: string): FormalQualityDeductionLedgerFact | null {
  const pending = caseFact.pendingDeductionRecord
  if (!pending) return null
  const adjudicatedWithLedger =
    caseFact.disputeCase?.adjudicationResult === 'UPHELD' ||
    caseFact.disputeCase?.adjudicationResult === 'PARTIALLY_ADJUSTED'
  if (
    pending.status === 'PENDING_FACTORY_CONFIRM' ||
    (pending.status === 'DISPUTED' && !adjudicatedWithLedger) ||
    pending.status === 'CLOSED_WITHOUT_LEDGER'
  ) {
    return null
  }
  const disputeCase = caseFact.disputeCase
  if (disputeCase?.adjudicationResult === 'REVERSED') return null
  const originalAmount =
    disputeCase?.adjudicationResult === 'PARTIALLY_ADJUSTED'
      ? disputeCase.adjudicatedAmount ?? pending.originalAmount
      : pending.originalAmount
  const fxRate = pending.fxRate ?? 1
  const existing = caseFact.formalLedger
  const ledger: FormalQualityDeductionLedgerFact = existing ?? {
    ledgerId: nextLifecycleId(`QDL-${sanitizeIdPart(caseFact.qcRecord.qcId)}`),
    ledgerNo: nextLifecycleId(`LEDGER-${sanitizeIdPart(caseFact.qcRecord.qcId)}`),
    qcId: caseFact.qcRecord.qcId,
    pendingRecordId: pending.pendingRecordId,
    basisId: pending.basisId,
    disputeId: disputeCase?.disputeId,
    factoryId: pending.factoryId,
    factoryName: pending.factoryName,
    settlementPartyType: pending.settlementPartyType,
    settlementPartyId: pending.settlementPartyId,
    productionOrderNo: pending.productionOrderNo,
    returnInboundBatchNo: pending.returnInboundBatchNo,
    taskId: pending.taskId,
    status: 'GENERATED_PENDING_STATEMENT',
    triggerSource: resolveLedgerTrigger(caseFact),
    originalCurrency: pending.originalCurrency,
    originalAmount,
    settlementCurrency: pending.settlementCurrency,
    settlementAmount: roundAmount(originalAmount * fxRate),
    fxRate,
    fxAppliedAt: pending.fxAppliedAt,
    generatedAt: at,
    generatedBy: by,
  }
  ledger.triggerSource = resolveLedgerTrigger(caseFact)
  ledger.originalAmount = originalAmount
  ledger.settlementAmount = roundAmount(originalAmount * fxRate)
  ledger.originalCurrency = pending.originalCurrency
  ledger.settlementCurrency = pending.settlementCurrency
  ledger.fxRate = fxRate
  ledger.fxAppliedAt = pending.fxAppliedAt ?? at
  ledger.generatedAt = existing?.generatedAt ?? at
  ledger.generatedBy = existing?.generatedBy ?? by
  ledger.status = resolveLedgerStatus(caseFact)
  ledger.includedStatementId = caseFact.settlementImpact.includedSettlementStatementId
  ledger.includedPrepaymentBatchId = caseFact.settlementImpact.includedSettlementBatchId
  ledger.prepaidAt = caseFact.settlementImpact.settledAt
  ledger.comment =
    disputeCase?.adjustmentReasonSummary ??
    disputeCase?.adjudicationComment ??
    pending.handledComment
  caseFact.formalLedger = ledger
  syncLedgerRegistry(caseFact)
  return ledger
}

function syncCompatibilityFacts(caseFact: QualityDeductionCaseFact): void {
  const pending = caseFact.pendingDeductionRecord
  const ledger = caseFact.formalLedger
  const dispute = caseFact.disputeCase
  const basis = caseFact.deductionBasis
  const impact = caseFact.settlementImpact

  if (pending) {
    caseFact.factoryResponse = caseFact.factoryResponse ?? {
      responseId: `QFR-${caseFact.qcRecord.qcId}`,
      qcId: caseFact.qcRecord.qcId,
      factoryId: pending.factoryId,
      factoryResponseStatus: 'PENDING_RESPONSE',
      isOverdue: false,
    }
    caseFact.factoryResponse.responseDeadlineAt = pending.responseDeadlineAt
    caseFact.factoryResponse.respondedAt = pending.handledAt
    caseFact.factoryResponse.autoConfirmedAt =
      pending.status === 'SYSTEM_AUTO_CONFIRMED' ? pending.handledAt : undefined
    caseFact.factoryResponse.responderUserName = pending.handledBy
    caseFact.factoryResponse.responseComment = pending.handledComment ?? pending.pendingReasonSummary
    caseFact.factoryResponse.isOverdue = pending.isOverdue
    caseFact.factoryResponse.responseAction =
      pending.status === 'FACTORY_CONFIRMED'
        ? 'CONFIRM'
        : pending.status === 'SYSTEM_AUTO_CONFIRMED'
          ? 'AUTO_CONFIRM'
          : pending.status === 'DISPUTED'
            ? 'DISPUTE'
            : undefined
    caseFact.factoryResponse.factoryResponseStatus =
      pending.status === 'PENDING_FACTORY_CONFIRM'
        ? 'PENDING_RESPONSE'
        : pending.status === 'FACTORY_CONFIRMED'
          ? 'CONFIRMED'
          : pending.status === 'SYSTEM_AUTO_CONFIRMED'
            ? 'AUTO_CONFIRMED'
            : pending.status === 'DISPUTED'
              ? 'DISPUTED'
              : 'NOT_REQUIRED'
  }

  if (!caseFact.qcRecord.isLegacy) {
    clearAdjustmentCompat(caseFact)
  }

  if (basis) {
    if (ledger) {
      basis.status = dispute?.adjudicationResult === 'PARTIALLY_ADJUSTED' ? 'ADJUSTED' : 'EFFECTIVE'
      basis.effectiveQualityDeductionAmount = ledger.originalAmount
      basis.proposedQualityDeductionAmount = Math.max(basis.proposedQualityDeductionAmount, ledger.originalAmount)
      basis.effectiveAt = basis.effectiveAt ?? ledger.generatedAt
      basis.adjustedAt = dispute?.adjudicationResult === 'PARTIALLY_ADJUSTED' ? dispute.adjudicatedAt : basis.adjustedAt
      basis.cancelledAt = undefined
    } else if (pending?.status === 'DISPUTED') {
      basis.status = 'GENERATED'
    } else if (pending?.status === 'CLOSED_WITHOUT_LEDGER') {
      basis.status = 'CANCELLED'
      basis.cancelledAt = dispute?.adjudicatedAt ?? pending.handledAt ?? basis.cancelledAt
      basis.effectiveQualityDeductionAmount = 0
      basis.blockedProcessingFeeAmount = 0
      basis.deductionQty = 0
    }
  }

  if (dispute) {
    dispute.resultWrittenBackAt = dispute.adjudicatedAt ?? dispute.resultWrittenBackAt
  }

  if (ledger) {
    impact.blockedSettlementQty = 0
    impact.blockedProcessingFeeAmount = 0
    impact.effectiveQualityDeductionAmount = ledger.originalAmount
    impact.candidateSettlementCycleId = impact.candidateSettlementCycleId ?? ledger.includedStatementId
    impact.includedSettlementStatementId = ledger.includedStatementId
    impact.includedSettlementBatchId = ledger.includedPrepaymentBatchId
    impact.settledAt = ledger.prepaidAt
    impact.eligibleAt = ledger.generatedAt
    impact.lastWrittenBackAt = ledger.generatedAt
    impact.status =
      ledger.status === 'GENERATED_PENDING_STATEMENT'
        ? 'ELIGIBLE'
        : ledger.status === 'INCLUDED_IN_STATEMENT' || ledger.status === 'INCLUDED_IN_PREPAYMENT_BATCH'
          ? 'INCLUDED_IN_STATEMENT'
          : 'SETTLED'
    impact.summary =
      ledger.status === 'GENERATED_PENDING_STATEMENT'
        ? '正式质量扣款流水已生成，待进入预结算单'
        : ledger.status === 'INCLUDED_IN_STATEMENT'
          ? '正式质量扣款流水已进入预结算单'
          : ledger.status === 'INCLUDED_IN_PREPAYMENT_BATCH'
            ? '正式质量扣款流水已进入预付款批次'
            : '正式质量扣款流水已完成预付'
  } else if (pending?.status === 'PENDING_FACTORY_CONFIRM' || pending?.status === 'DISPUTED' || dispute?.status === 'PENDING_REVIEW' || dispute?.status === 'IN_REVIEW') {
    impact.status = 'BLOCKED'
    impact.blockedSettlementQty = caseFact.qcRecord.factoryLiabilityQty
    impact.blockedProcessingFeeAmount = basis?.blockedProcessingFeeAmount ?? 0
    impact.effectiveQualityDeductionAmount = 0
    impact.eligibleAt = undefined
    impact.summary =
      pending?.status === 'DISPUTED'
        ? '工厂已发起质量异议，待平台处理后再决定是否生成正式质量扣款流水'
        : '存在待确认质量扣款记录，待工厂处理后再生成正式质量扣款流水'
  } else {
    impact.status = 'NO_IMPACT'
    impact.blockedSettlementQty = 0
    impact.blockedProcessingFeeAmount = 0
    impact.effectiveQualityDeductionAmount = 0
    impact.eligibleAt = undefined
    impact.summary = '当前未形成正式质量扣款流水，不进入预结算'
  }
  impact.totalFinancialImpactAmount = roundAmount(
    impact.blockedProcessingFeeAmount + impact.effectiveQualityDeductionAmount,
  )
}

export function deriveCaseStatus(caseFact: QualityDeductionCaseFact): QualityDeductionCaseStatus {
  return deriveQualityDeductionCaseStatus(caseFact)
}

export function findAutoConfirmCandidates(now: Date = getQualityDeductionNow()): QualityDeductionCaseFact[] {
  return qualityDeductionSharedCaseFacts.filter((caseFact) => {
    const pending = caseFact.pendingDeductionRecord
    if (!pending) return false
    if (caseFact.qcRecord.isLegacy || caseFact.qcRecord.qcStatus === 'CLOSED') return false
    if (pending.status !== 'PENDING_FACTORY_CONFIRM') return false
    const deadlineMs = parseQualityDeductionTimestamp(pending.responseDeadlineAt)
    if (deadlineMs === null || now.getTime() <= deadlineMs) return false
    return true
  })
}

export function resolveSettlementImpactAfterConfirmation(
  qcId: string,
  at: string = formatQualityDeductionTimestamp(),
  actorLabel = '工厂确认',
): LifecycleResultOk | LifecycleResultError {
  const caseFact = getCaseFactByQcId(qcId)
  if (!caseFact) return { ok: false, message: '未找到对应质检记录' }
  const pending = caseFact.pendingDeductionRecord
  if (!pending) return { ok: false, message: '当前记录不存在待确认质量扣款记录' }
  if (caseFact.disputeCase && (caseFact.disputeCase.status === 'PENDING_REVIEW' || caseFact.disputeCase.status === 'IN_REVIEW')) {
    return { ok: false, message: '当前存在待处理质量异议单，不能直接生成正式质量扣款流水' }
  }
  if (caseFact.formalLedger) {
    syncCompatibilityFacts(caseFact)
    return { ok: true, caseFact }
  }

  ensurePendingRecord(caseFact, pending.status === 'SYSTEM_AUTO_CONFIRMED' ? 'SYSTEM_AUTO_CONFIRMED' : 'FACTORY_CONFIRMED', at, actorLabel)
  buildLedger(caseFact, at, actorLabel)
  syncCompatibilityFacts(caseFact)

  caseFact.qcRecord.updatedAt = at
  appendQcAuditLog(caseFact, `${actorLabel}后生成正式质量扣款流水`, actorLabel, at, 'GENERATE_QUALITY_LEDGER')
  appendBasisAuditLog(caseFact, '待确认质量扣款记录处理完成，正式质量扣款流水已生成', actorLabel, at, 'GENERATE_QUALITY_LEDGER')

  return { ok: true, caseFact }
}

export function autoConfirmOverdueQualityCases(now: Date = getQualityDeductionNow()): {
  processedQcIds: string[]
  skippedQcIds: string[]
} {
  const processedQcIds: string[] = []
  const skippedQcIds: string[] = []
  const at = formatQualityDeductionTimestamp(now)

  for (const caseFact of findAutoConfirmCandidates(now)) {
    if (caseFact.formalLedger) {
      skippedQcIds.push(caseFact.qcRecord.qcId)
      continue
    }
    ensurePendingRecord(caseFact, 'SYSTEM_AUTO_CONFIRMED', at, AUTO_CONFIRM_SYSTEM_USER, '超过 48 小时未发起异议，系统自动确认。')
    if (caseFact.factoryResponse) {
      caseFact.factoryResponse.factoryResponseStatus = 'AUTO_CONFIRMED'
      caseFact.factoryResponse.responseAction = 'AUTO_CONFIRM'
      caseFact.factoryResponse.respondedAt = at
      caseFact.factoryResponse.autoConfirmedAt = at
      caseFact.factoryResponse.responderUserName = AUTO_CONFIRM_SYSTEM_USER
      caseFact.factoryResponse.responseComment = '超过 48 小时未发起异议，系统自动确认。'
      caseFact.factoryResponse.isOverdue = true
    }
    const result = resolveSettlementImpactAfterConfirmation(caseFact.qcRecord.qcId, at, AUTO_CONFIRM_SYSTEM_USER)
    if (!result.ok) {
      skippedQcIds.push(caseFact.qcRecord.qcId)
      continue
    }
    processedQcIds.push(caseFact.qcRecord.qcId)
  }

  return { processedQcIds, skippedQcIds }
}

export function syncQualityDeductionLifecycle(now: Date = getQualityDeductionNow()): void {
  autoConfirmOverdueQualityCases(now)
  for (const caseFact of qualityDeductionSharedCaseFacts) {
    syncCompatibilityFacts(caseFact)
  }
}

export function adjudicateDisputeCase(
  input: QualityDeductionDisputeAdjudicationInput,
): LifecycleResultOk | LifecycleResultError {
  const caseFact = getCaseFactByQcId(input.qcId)
  if (!caseFact) {
    return { ok: false, message: '未找到对应质检记录' }
  }
  const disputeCase = caseFact.disputeCase
  if (!disputeCase) {
    return { ok: false, message: '当前记录不存在可裁决异议单' }
  }
  if (!(disputeCase.status === 'PENDING_REVIEW' || disputeCase.status === 'IN_REVIEW')) {
    return { ok: false, message: '当前异议单已完成裁决，不能重复处理' }
  }
  if (!input.adjudicationComment.trim()) {
    return { ok: false, message: '请填写裁决意见' }
  }

  const at = input.adjudicatedAt ?? formatQualityDeductionTimestamp()
  const pending = caseFact.pendingDeductionRecord
  if (!pending) {
    return { ok: false, message: '当前记录不存在待确认质量扣款记录' }
  }

  disputeCase.reviewerUserName = input.reviewerUserName
  disputeCase.adjudicatedAt = at
  disputeCase.resultWrittenBackAt = at
  disputeCase.adjudicationComment = input.adjudicationComment.trim()

  if (input.adjudicationResult === 'UPHELD') {
    disputeCase.status = 'UPHELD'
    disputeCase.adjudicationResult = 'UPHELD'
    disputeCase.adjudicatedAmount = pending.originalAmount
    ensurePendingRecord(caseFact, 'DISPUTED', at, input.reviewerUserName, input.adjudicationComment.trim())
    buildLedger(caseFact, at, input.reviewerUserName)
  } else if (input.adjudicationResult === 'PARTIALLY_ADJUSTED') {
    if (input.adjustedEffectiveQualityDeductionAmount === undefined || input.adjustedEffectiveQualityDeductionAmount < 0) {
      return { ok: false, message: '请填写有效的裁决金额' }
    }
    disputeCase.status = 'PARTIALLY_ADJUSTED'
    disputeCase.adjudicationResult = 'PARTIALLY_ADJUSTED'
    disputeCase.adjudicatedAmount = input.adjustedEffectiveQualityDeductionAmount
    disputeCase.adjustedLiableQty = input.adjustedLiableQty
    disputeCase.adjustedBlockedProcessingFeeAmount = input.adjustedBlockedProcessingFeeAmount
    disputeCase.adjustedEffectiveQualityDeductionAmount = input.adjustedEffectiveQualityDeductionAmount
    disputeCase.adjustmentReasonSummary = input.adjustmentReasonSummary
    pending.originalAmount = input.adjustedEffectiveQualityDeductionAmount
    pending.settlementAmount = roundAmount(input.adjustedEffectiveQualityDeductionAmount * (pending.fxRate ?? 1))
    pending.fxAppliedAt = at
    ensurePendingRecord(caseFact, 'DISPUTED', at, input.reviewerUserName, input.adjudicationComment.trim())
    buildLedger(caseFact, at, input.reviewerUserName)
  } else {
    disputeCase.status = 'REVERSED'
    disputeCase.adjudicationResult = 'REVERSED'
    disputeCase.adjudicatedAmount = 0
    pending.originalAmount = 0
    pending.settlementAmount = 0
    ensurePendingRecord(caseFact, 'CLOSED_WITHOUT_LEDGER', at, input.reviewerUserName, input.adjudicationComment.trim())
    clearLedgerRegistry(caseFact)
  }

  syncCompatibilityFacts(caseFact)
  caseFact.qcRecord.updatedAt = at
  appendQcAuditLog(
    caseFact,
    `平台完成质量异议处理：${input.adjudicationComment.trim()}`,
    input.reviewerUserName,
    at,
    'PLATFORM_ADJUDICATE_DISPUTE',
  )
  appendBasisAuditLog(caseFact, '平台完成质量异议处理，已回写待确认质量扣款记录与正式流水结果', input.reviewerUserName, at, 'PLATFORM_ADJUDICATE_DISPUTE')

  return { ok: true, caseFact }
}
