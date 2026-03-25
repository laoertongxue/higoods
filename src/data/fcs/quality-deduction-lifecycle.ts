import { qualityDeductionSharedCaseFacts, qualityDeductionSharedSettlementAdjustments } from './quality-deduction-shared-facts.ts'
import type {
  QualityDeductionCaseFact,
  QualityDeductionCaseStatus,
  QualityDeductionDisputeAdjudicationInput,
  QualityDeductionSettlementAdjustmentType,
  SettlementAdjustmentFact,
} from './quality-deduction-domain.ts'
import { deriveQualityDeductionCaseStatus } from './quality-deduction-domain.ts'

type SettlementStage = 'NOT_INCLUDED' | 'INCLUDED_UNLOCKED' | 'LOCKED' | 'SETTLED'

interface LifecycleResultOk {
  ok: true
  caseFact: QualityDeductionCaseFact
}

interface LifecycleResultError {
  ok: false
  message: string
}

interface GeneratedAdjustmentInput {
  caseFact: QualityDeductionCaseFact
  generatedAt: string
  adjustmentType: QualityDeductionSettlementAdjustmentType
  adjustmentQty: number
  adjustmentAmount: number
  targetSettlementCycleId: string
  adjustmentReasonCode: string
  adjustmentReasonSummary: string
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

function getSettlementStage(caseFact: QualityDeductionCaseFact): SettlementStage {
  const impact = caseFact.settlementImpact
  if (impact.status === 'SETTLED' || Boolean(impact.settledAt)) return 'SETTLED'
  if (impact.includedSettlementStatementId || impact.includedSettlementBatchId) {
    return impact.statementLockedAt ? 'LOCKED' : 'INCLUDED_UNLOCKED'
  }
  return 'NOT_INCLUDED'
}

function resolveNextSettlementCycleId(at: string, currentCycleId?: string): string {
  if (currentCycleId) {
    const weekly = /^STL-(\d{4})-(\d{2})-W(\d+)$/.exec(currentCycleId)
    if (weekly) {
      const [, year, month, week] = weekly
      return `STL-${year}-${month}-W${String(Number(week) + 1)}`
    }

    const sequence = /^STL-(\d{4})-(\d{2})-(\d{3})$/.exec(currentCycleId)
    if (sequence) {
      const [, year, month, seq] = sequence
      return `STL-${year}-${month}-${String(Number(seq) + 1).padStart(3, '0')}`
    }
  }

  const [datePart] = at.split(' ')
  const [, year = '2026', month = '01', day = '01'] = (datePart ?? '').split('-')
  const week = Math.max(1, Math.ceil(Number(day || '1') / 7))
  return `STL-${year}-${month}-W${week}`
}

function updateSettlementImpactTotals(caseFact: QualityDeductionCaseFact): void {
  caseFact.settlementImpact.totalFinancialImpactAmount = roundAmount(
    caseFact.settlementImpact.blockedProcessingFeeAmount +
      caseFact.settlementImpact.effectiveQualityDeductionAmount,
  )
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

function clearOpenCycleInclusion(caseFact: QualityDeductionCaseFact): void {
  caseFact.settlementImpact.includedAt = undefined
  caseFact.settlementImpact.includedSettlementStatementId = undefined
  caseFact.settlementImpact.includedSettlementBatchId = undefined
  caseFact.settlementImpact.statementLockedAt = undefined
}

function ensureBasisEffective(caseFact: QualityDeductionCaseFact, at: string, by: string): void {
  if (!caseFact.deductionBasis) return
  if (caseFact.deductionBasis.status === 'CANCELLED') return
  if (caseFact.deductionBasis.status === 'GENERATED') {
    caseFact.deductionBasis.status = 'EFFECTIVE'
  }
  caseFact.deductionBasis.effectiveAt = caseFact.deductionBasis.effectiveAt ?? at
  caseFact.deductionBasis.updatedAt = at
  caseFact.deductionBasis.updatedBy = by
}

function clearAdjustment(caseFact: QualityDeductionCaseFact): void {
  if (!caseFact.settlementAdjustment) return
  const targetId = caseFact.settlementAdjustment.adjustmentId
  caseFact.settlementAdjustment = null
  const next = qualityDeductionSharedSettlementAdjustments.filter((item) => item.adjustmentId !== targetId)
  qualityDeductionSharedSettlementAdjustments.splice(0, qualityDeductionSharedSettlementAdjustments.length, ...next)
}

function syncAdjustmentRegistry(adjustment: SettlementAdjustmentFact): void {
  const index = qualityDeductionSharedSettlementAdjustments.findIndex((item) => item.adjustmentId === adjustment.adjustmentId)
  if (index >= 0) {
    qualityDeductionSharedSettlementAdjustments[index] = adjustment
    return
  }
  qualityDeductionSharedSettlementAdjustments.push(adjustment)
}

export function deriveCaseStatus(caseFact: QualityDeductionCaseFact): QualityDeductionCaseStatus {
  return deriveQualityDeductionCaseStatus(caseFact)
}

export function findAutoConfirmCandidates(now: Date = getQualityDeductionNow()): QualityDeductionCaseFact[] {
  return qualityDeductionSharedCaseFacts.filter((caseFact) => {
    const { qcRecord, factoryResponse, disputeCase, settlementImpact } = caseFact
    if (!factoryResponse) return false
    if (qcRecord.isLegacy || qcRecord.qcStatus === 'CLOSED') return false
    if (qcRecord.qcResult === 'QUALIFIED') return false
    if (qcRecord.factoryLiabilityQty <= 0) return false
    if (qcRecord.liabilityStatus === 'NON_FACTORY') return false
    if (factoryResponse.factoryResponseStatus !== 'PENDING_RESPONSE') return false
    if (settlementImpact.status === 'SETTLED' || settlementImpact.status === 'NO_IMPACT') return false
    const deadlineMs = parseQualityDeductionTimestamp(factoryResponse.responseDeadlineAt)
    if (deadlineMs === null || now.getTime() <= deadlineMs) return false
    if (disputeCase && disputeCase.status !== 'NONE') return false
    return true
  })
}

export function resolveSettlementImpactAfterConfirmation(
  qcId: string,
  at: string = formatQualityDeductionTimestamp(),
  actorLabel = '工厂确认',
): LifecycleResultOk | LifecycleResultError {
  const caseFact = getCaseFactByQcId(qcId)
  if (!caseFact) {
    return { ok: false, message: '未找到对应质检记录' }
  }

  const stage = getSettlementStage(caseFact)
  const impact = caseFact.settlementImpact
  const basis = caseFact.deductionBasis
  ensureBasisEffective(caseFact, at, actorLabel)
  clearAdjustment(caseFact)

  if (stage === 'NOT_INCLUDED') {
    impact.status = 'ELIGIBLE'
    impact.blockedSettlementQty = 0
    impact.blockedProcessingFeeAmount = 0
    impact.effectiveQualityDeductionAmount = basis?.effectiveQualityDeductionAmount ?? impact.effectiveQualityDeductionAmount
    impact.candidateSettlementCycleId =
      impact.candidateSettlementCycleId ?? resolveNextSettlementCycleId(at, impact.candidateSettlementCycleId)
    impact.eligibleAt = impact.eligibleAt ?? at
    impact.lastWrittenBackAt = at
    impact.summary = `${actorLabel}后，待纳入 ${impact.candidateSettlementCycleId} 结算`
  } else if (stage === 'INCLUDED_UNLOCKED') {
    impact.status = 'INCLUDED_IN_STATEMENT'
    impact.blockedSettlementQty = 0
    impact.blockedProcessingFeeAmount = 0
    impact.effectiveQualityDeductionAmount = basis?.effectiveQualityDeductionAmount ?? impact.effectiveQualityDeductionAmount
    impact.includedAt = impact.includedAt ?? at
    impact.lastWrittenBackAt = at
    impact.summary = `${actorLabel}后，沿用当前结算单 ${impact.includedSettlementStatementId ?? impact.candidateSettlementCycleId ?? ''}`.trim()
  } else if (stage === 'LOCKED') {
    impact.status = 'INCLUDED_IN_STATEMENT'
    impact.blockedSettlementQty = 0
    impact.blockedProcessingFeeAmount = 0
    impact.effectiveQualityDeductionAmount = basis?.effectiveQualityDeductionAmount ?? impact.effectiveQualityDeductionAmount
    impact.lastWrittenBackAt = at
    impact.summary = `${actorLabel}后，当前记录已纳入锁账批次 ${impact.includedSettlementBatchId ?? impact.candidateSettlementCycleId ?? ''}`.trim()
  } else {
    impact.status = 'SETTLED'
    impact.lastWrittenBackAt = at
    impact.summary = `${actorLabel}后，历史结算批次保持不变`
  }

  updateSettlementImpactTotals(caseFact)
  return { ok: true, caseFact }
}

export function autoConfirmOverdueQualityCases(now: Date = getQualityDeductionNow()): {
  processedQcIds: string[]
  skippedQcIds: string[]
} {
  const processedQcIds: string[] = []
  const skippedQcIds: string[] = []

  for (const caseFact of findAutoConfirmCandidates(now)) {
    if (caseFact.factoryResponse?.factoryResponseStatus === 'AUTO_CONFIRMED') {
      skippedQcIds.push(caseFact.qcRecord.qcId)
      continue
    }

    const at = formatQualityDeductionTimestamp(now)
    caseFact.factoryResponse!.factoryResponseStatus = 'AUTO_CONFIRMED'
    caseFact.factoryResponse!.responseAction = 'AUTO_CONFIRM'
    caseFact.factoryResponse!.autoConfirmedAt = caseFact.factoryResponse!.autoConfirmedAt ?? at
    caseFact.factoryResponse!.respondedAt = caseFact.factoryResponse!.respondedAt ?? at
    caseFact.factoryResponse!.responderUserName = caseFact.factoryResponse!.responderUserName ?? AUTO_CONFIRM_SYSTEM_USER
    caseFact.factoryResponse!.responseComment = caseFact.factoryResponse!.responseComment ?? '超过 48 小时未发起异议，系统自动确认。'
    caseFact.factoryResponse!.isOverdue = true

    const settlementResult = resolveSettlementImpactAfterConfirmation(
      caseFact.qcRecord.qcId,
      at,
      AUTO_CONFIRM_SYSTEM_USER,
    )
    if (!settlementResult.ok) {
      skippedQcIds.push(caseFact.qcRecord.qcId)
      continue
    }

    caseFact.qcRecord.updatedAt = at
    appendQcAuditLog(caseFact, '超过 48 小时未收到工厂异议，系统自动确认处理结果。', AUTO_CONFIRM_SYSTEM_USER, at, 'AUTO_CONFIRM_RESPONSE')
    appendBasisAuditLog(caseFact, '系统自动确认后，扣款依据转入生效并等待结算。', AUTO_CONFIRM_SYSTEM_USER, at, 'AUTO_CONFIRM_BASIS')
    processedQcIds.push(caseFact.qcRecord.qcId)
  }

  return { processedQcIds, skippedQcIds }
}

export function syncQualityDeductionLifecycle(now: Date = getQualityDeductionNow()): void {
  autoConfirmOverdueQualityCases(now)
}

export function maybeGenerateSettlementAdjustment(
  input: GeneratedAdjustmentInput,
): SettlementAdjustmentFact | null {
  if (input.adjustmentAmount <= 0) return null

  const existing = input.caseFact.settlementAdjustment
  const nextAdjustment: SettlementAdjustmentFact = existing
    ? existing
    : {
        adjustmentId: nextLifecycleId(`SADJ-${sanitizeIdPart(input.caseFact.qcRecord.qcId)}`),
        adjustmentNo: nextLifecycleId(`ADJ-${sanitizeIdPart(input.caseFact.qcRecord.qcId)}`),
        qcId: input.caseFact.qcRecord.qcId,
        basisId: input.caseFact.deductionBasis?.basisId ?? '',
        disputeId: input.caseFact.disputeCase?.disputeId ?? '',
        adjustmentType: input.adjustmentType,
        adjustmentQty: input.adjustmentQty,
        adjustmentAmount: input.adjustmentAmount,
        currency: 'CNY',
        targetSettlementCycleId: input.targetSettlementCycleId,
        adjustmentReasonCode: input.adjustmentReasonCode,
        adjustmentReasonSummary: input.adjustmentReasonSummary,
        writebackStatus: 'PENDING_WRITEBACK',
        generatedAt: input.generatedAt,
        summary: input.adjustmentReasonSummary,
      }

  nextAdjustment.basisId = input.caseFact.deductionBasis?.basisId ?? nextAdjustment.basisId
  nextAdjustment.disputeId = input.caseFact.disputeCase?.disputeId ?? nextAdjustment.disputeId
  nextAdjustment.adjustmentType = input.adjustmentType
  nextAdjustment.adjustmentQty = input.adjustmentQty
  nextAdjustment.adjustmentAmount = roundAmount(input.adjustmentAmount)
  nextAdjustment.currency = 'CNY'
  nextAdjustment.targetSettlementCycleId = input.targetSettlementCycleId
  nextAdjustment.adjustmentReasonCode = input.adjustmentReasonCode
  nextAdjustment.adjustmentReasonSummary = input.adjustmentReasonSummary
  nextAdjustment.writebackStatus = 'PENDING_WRITEBACK'
  nextAdjustment.generatedAt = existing?.generatedAt ?? input.generatedAt
  nextAdjustment.writtenBackAt = undefined
  nextAdjustment.summary = input.adjustmentReasonSummary

  input.caseFact.settlementAdjustment = nextAdjustment
  syncAdjustmentRegistry(nextAdjustment)
  return nextAdjustment
}

export function resolveSettlementImpactAfterAdjudication(
  input: QualityDeductionDisputeAdjudicationInput,
): LifecycleResultOk | LifecycleResultError {
  const caseFact = getCaseFactByQcId(input.qcId)
  if (!caseFact) {
    return { ok: false, message: '未找到对应质检记录' }
  }

  const disputeCase = caseFact.disputeCase
  const basis = caseFact.deductionBasis
  const impact = caseFact.settlementImpact
  if (!disputeCase || !basis) {
    return { ok: false, message: '当前记录缺少异议单或扣款依据' }
  }

  const at = input.adjudicatedAt ?? formatQualityDeductionTimestamp()
  const stage = getSettlementStage(caseFact)
  const previousLiableQty = basis.deductionQty
  const previousBlockedProcessingFeeAmount = impact.blockedProcessingFeeAmount
  const previousEffectiveQualityDeductionAmount = impact.effectiveQualityDeductionAmount
  const previousTotalFinancialImpact = previousBlockedProcessingFeeAmount + previousEffectiveQualityDeductionAmount

  disputeCase.reviewerUserName = input.reviewerUserName
  disputeCase.adjudicatedAt = at
  disputeCase.adjudicationResult = input.adjudicationResult
  disputeCase.adjudicationComment = input.adjudicationComment.trim()
  disputeCase.resultWrittenBackAt = at

  if (input.adjudicationResult === 'UPHELD') {
    disputeCase.status = 'UPHELD'
    disputeCase.adjudicatedAmount = previousEffectiveQualityDeductionAmount
    basis.status = 'EFFECTIVE'
    basis.effectiveAt = basis.effectiveAt ?? at
    basis.updatedAt = at
    basis.updatedBy = input.reviewerUserName
    basis.adjustmentReasonSummary = undefined
    clearAdjustment(caseFact)

    if (stage === 'NOT_INCLUDED') {
      impact.status = 'ELIGIBLE'
      impact.blockedSettlementQty = 0
      impact.blockedProcessingFeeAmount = 0
      impact.effectiveQualityDeductionAmount = basis.effectiveQualityDeductionAmount
      impact.candidateSettlementCycleId =
        impact.candidateSettlementCycleId ?? resolveNextSettlementCycleId(at, impact.candidateSettlementCycleId)
      impact.eligibleAt = impact.eligibleAt ?? at
      impact.summary = `平台维持原判，待纳入 ${impact.candidateSettlementCycleId} 结算`
    } else if (stage === 'INCLUDED_UNLOCKED') {
      impact.status = 'INCLUDED_IN_STATEMENT'
      impact.blockedSettlementQty = 0
      impact.blockedProcessingFeeAmount = 0
      impact.effectiveQualityDeductionAmount = basis.effectiveQualityDeductionAmount
      impact.includedAt = impact.includedAt ?? at
      impact.summary = `平台维持原判，沿用当前结算单 ${impact.includedSettlementStatementId ?? impact.candidateSettlementCycleId ?? ''}`.trim()
    } else if (stage === 'LOCKED') {
      impact.status = 'INCLUDED_IN_STATEMENT'
      impact.blockedSettlementQty = 0
      impact.blockedProcessingFeeAmount = 0
      impact.effectiveQualityDeductionAmount = basis.effectiveQualityDeductionAmount
      impact.summary = `平台维持原判，当前已纳入锁账批次 ${impact.includedSettlementBatchId ?? impact.candidateSettlementCycleId ?? ''}`.trim()
    } else {
      impact.status = 'SETTLED'
      impact.summary = '平台维持原判，历史结算批次保持不变'
    }
  } else if (input.adjudicationResult === 'PARTIALLY_ADJUSTED') {
    if (
      input.adjustedLiableQty === undefined ||
      input.adjustedBlockedProcessingFeeAmount === undefined ||
      input.adjustedEffectiveQualityDeductionAmount === undefined
    ) {
      return { ok: false, message: '部分调整必须填写责任数量、冻结加工费金额和生效质量扣款金额' }
    }
    if (!input.adjustmentReasonSummary?.trim()) {
      return { ok: false, message: '部分调整请填写调整原因摘要' }
    }

    const adjustedLiableQty = Math.max(0, Math.floor(input.adjustedLiableQty))
    const adjustedBlockedProcessingFeeAmount = roundAmount(Math.max(0, input.adjustedBlockedProcessingFeeAmount))
    const adjustedEffectiveQualityDeductionAmount = roundAmount(Math.max(0, input.adjustedEffectiveQualityDeductionAmount))
    const adjustedTotalFinancialImpact =
      adjustedBlockedProcessingFeeAmount + adjustedEffectiveQualityDeductionAmount

    disputeCase.status = 'PARTIALLY_ADJUSTED'
    disputeCase.adjudicatedAmount = adjustedEffectiveQualityDeductionAmount
    disputeCase.adjustedLiableQty = adjustedLiableQty
    disputeCase.adjustedBlockedProcessingFeeAmount = adjustedBlockedProcessingFeeAmount
    disputeCase.adjustedEffectiveQualityDeductionAmount = adjustedEffectiveQualityDeductionAmount
    disputeCase.adjustmentReasonSummary = input.adjustmentReasonSummary.trim()

    caseFact.qcRecord.factoryLiabilityQty = adjustedLiableQty
    caseFact.qcRecord.nonFactoryLiabilityQty = Math.max(caseFact.qcRecord.unqualifiedQty - adjustedLiableQty, 0)
    caseFact.qcRecord.liabilityStatus =
      adjustedLiableQty <= 0
        ? 'NON_FACTORY'
        : caseFact.qcRecord.nonFactoryLiabilityQty > 0
          ? 'MIXED'
          : 'FACTORY'
    caseFact.qcRecord.deductionDecision =
      adjustedBlockedProcessingFeeAmount > 0 || adjustedEffectiveQualityDeductionAmount > 0 ? 'DEDUCT' : 'NO_DEDUCT'
    caseFact.qcRecord.deductionDecisionRemark = input.adjustmentReasonSummary.trim()

    basis.status = 'ADJUSTED'
    basis.deductionQty = adjustedLiableQty
    basis.blockedProcessingFeeAmount = adjustedBlockedProcessingFeeAmount
    basis.effectiveQualityDeductionAmount = adjustedEffectiveQualityDeductionAmount
    basis.adjustedAt = at
    basis.updatedAt = at
    basis.updatedBy = input.reviewerUserName
    basis.adjustmentReasonSummary = input.adjustmentReasonSummary.trim()

    if (stage === 'NOT_INCLUDED' || stage === 'INCLUDED_UNLOCKED') {
      clearAdjustment(caseFact)
      impact.status = stage === 'INCLUDED_UNLOCKED' ? 'INCLUDED_IN_STATEMENT' : 'ELIGIBLE'
      impact.blockedSettlementQty = 0
      impact.blockedProcessingFeeAmount = 0
      impact.effectiveQualityDeductionAmount = adjustedEffectiveQualityDeductionAmount
      impact.candidateSettlementCycleId =
        impact.candidateSettlementCycleId ?? resolveNextSettlementCycleId(at, impact.candidateSettlementCycleId)
      if (stage === 'NOT_INCLUDED') {
        impact.eligibleAt = impact.eligibleAt ?? at
      } else {
        impact.includedAt = impact.includedAt ?? at
      }
      impact.summary =
        stage === 'INCLUDED_UNLOCKED'
          ? `平台部分调整后，沿用当前结算单 ${impact.includedSettlementStatementId ?? impact.candidateSettlementCycleId ?? ''}`.trim()
          : `平台部分调整后，待纳入 ${impact.candidateSettlementCycleId} 结算`
    } else {
      const targetSettlementCycleId = resolveNextSettlementCycleId(
        at,
        impact.includedSettlementBatchId ?? impact.candidateSettlementCycleId,
      )
      const totalDelta = roundAmount(previousTotalFinancialImpact - adjustedTotalFinancialImpact)
      const adjustmentType: QualityDeductionSettlementAdjustmentType =
        totalDelta >= 0 ? 'DECREASE_DEDUCTION' : 'INCREASE_DEDUCTION'
      maybeGenerateSettlementAdjustment({
        caseFact,
        generatedAt: at,
        adjustmentType,
        adjustmentQty: Math.abs(previousLiableQty - adjustedLiableQty),
        adjustmentAmount: Math.abs(totalDelta),
        targetSettlementCycleId,
        adjustmentReasonCode: adjustmentType === 'DECREASE_DEDUCTION' ? 'DISPUTE_PARTIAL_ADJUST_DECREASE' : 'DISPUTE_PARTIAL_ADJUST_INCREASE',
        adjustmentReasonSummary: `当前结算批次已锁定，${input.adjustmentReasonSummary.trim()}`,
      })
      impact.status = 'NEXT_CYCLE_ADJUSTMENT_PENDING'
      impact.blockedSettlementQty = 0
      impact.blockedProcessingFeeAmount = 0
      impact.effectiveQualityDeductionAmount = adjustedEffectiveQualityDeductionAmount
      impact.candidateSettlementCycleId = targetSettlementCycleId
      impact.summary = `当前结算批次已锁定，调整差额将在 ${targetSettlementCycleId} 下周期结算中处理`
    }
  } else {
    disputeCase.status = 'REVERSED'
    disputeCase.adjudicatedAmount = 0
    disputeCase.adjustedLiableQty = 0
    disputeCase.adjustedBlockedProcessingFeeAmount = 0
    disputeCase.adjustedEffectiveQualityDeductionAmount = 0
    disputeCase.adjustmentReasonSummary = input.adjudicationComment.trim()

    caseFact.qcRecord.factoryLiabilityQty = 0
    caseFact.qcRecord.nonFactoryLiabilityQty = caseFact.qcRecord.unqualifiedQty
    caseFact.qcRecord.liabilityStatus = 'NON_FACTORY'
    caseFact.qcRecord.responsiblePartyType = undefined
    caseFact.qcRecord.responsiblePartyId = undefined
    caseFact.qcRecord.responsiblePartyName = undefined
    caseFact.qcRecord.deductionDecision = 'NO_DEDUCT'
    caseFact.qcRecord.deductionDecisionRemark = '平台改判为非工厂责任，不再执行质量扣款。'

    basis.status = 'CANCELLED'
    basis.deductionQty = 0
    basis.blockedProcessingFeeAmount = 0
    basis.effectiveQualityDeductionAmount = 0
    basis.cancelledAt = at
    basis.updatedAt = at
    basis.updatedBy = input.reviewerUserName
    basis.adjustmentReasonSummary = input.adjudicationComment.trim()

    if (stage === 'NOT_INCLUDED' || stage === 'INCLUDED_UNLOCKED') {
      clearAdjustment(caseFact)
      impact.status = 'NO_IMPACT'
      impact.blockedSettlementQty = 0
      impact.blockedProcessingFeeAmount = 0
      impact.effectiveQualityDeductionAmount = 0
      impact.candidateSettlementCycleId = undefined
      impact.eligibleAt = undefined
      if (stage === 'INCLUDED_UNLOCKED') {
        clearOpenCycleInclusion(caseFact)
      }
      impact.summary = '平台改判为非工厂责任，当前不再影响结算'
    } else {
      const targetSettlementCycleId = resolveNextSettlementCycleId(
        at,
        impact.includedSettlementBatchId ?? impact.candidateSettlementCycleId,
      )
      maybeGenerateSettlementAdjustment({
        caseFact,
        generatedAt: at,
        adjustmentType: 'REVERSAL',
        adjustmentQty: previousLiableQty,
        adjustmentAmount: previousTotalFinancialImpact,
        targetSettlementCycleId,
        adjustmentReasonCode: 'DISPUTE_REVERSAL',
        adjustmentReasonSummary: `当前结算批次已锁定，平台改判为非工厂责任，需在 ${targetSettlementCycleId} 冲回`,
      })
      impact.status = 'NEXT_CYCLE_ADJUSTMENT_PENDING'
      impact.blockedSettlementQty = 0
      impact.blockedProcessingFeeAmount = 0
      impact.effectiveQualityDeductionAmount = 0
      impact.candidateSettlementCycleId = targetSettlementCycleId
      impact.summary = `平台改判为非工厂责任，将在 ${targetSettlementCycleId} 下周期冲回`
    }
  }

  impact.lastWrittenBackAt = at
  updateSettlementImpactTotals(caseFact)
  return { ok: true, caseFact }
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

  const result = resolveSettlementImpactAfterAdjudication(input)
  if (!result.ok) return result

  const at = input.adjudicatedAt ?? formatQualityDeductionTimestamp()
  const resultLabel =
    input.adjudicationResult === 'UPHELD'
      ? '维持原判'
      : input.adjudicationResult === 'PARTIALLY_ADJUSTED'
        ? '部分调整'
        : '改判为非工厂责任'
  appendQcAuditLog(
    result.caseFact,
    `平台完成异议裁决：${resultLabel}。${input.adjudicationComment.trim()}`,
    input.reviewerUserName,
    at,
    'PLATFORM_ADJUDICATE_DISPUTE',
  )
  appendBasisAuditLog(
    result.caseFact,
    `平台裁决结果已回写：${resultLabel}`,
    input.reviewerUserName,
    at,
    'PLATFORM_ADJUDICATE_DISPUTE',
  )

  result.caseFact.qcRecord.updatedAt = at
  return result
}
