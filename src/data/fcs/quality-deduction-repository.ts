import {
  getQualityDeductionCaseStatus,
  qualityDeductionSharedCaseFacts,
  qualityDeductionSharedDeductionBases,
  qualityDeductionSharedDisputeCases,
  qualityDeductionSharedFactoryResponses,
  qualityDeductionSharedQcRecords,
  qualityDeductionSharedSettlementAdjustments,
  qualityDeductionSharedSettlementImpacts,
  type QualityDeductionValidationIssue,
  validateQualityDeductionSharedFacts,
} from './quality-deduction-shared-facts.ts'
import type {
  DeductionBasisFact,
  DisputeCaseFact,
  FactoryResponseFact,
  QualityDeductionDisputeSubmissionInput,
  QualityDeductionFactoryConfirmInput,
  QualityDeductionCaseFact,
  QualityDeductionCaseStatus,
  QualityEvidenceAsset,
  QcRecordFact,
  SettlementAdjustmentFact,
  SettlementImpactFact,
} from './quality-deduction-domain.ts'
import {
  resolveSettlementImpactAfterConfirmation,
  syncQualityDeductionLifecycle,
} from './quality-deduction-lifecycle.ts'

const caseByQcId = new Map<string, QualityDeductionCaseFact>()
const caseByBasisId = new Map<string, QualityDeductionCaseFact>()
const caseByDisputeId = new Map<string, QualityDeductionCaseFact>()
const qcIdByRouteAlias = new Map<string, string>()
let runtimeMutationSequence = 1

function indexCaseFact(caseFact: QualityDeductionCaseFact): void {
  caseByQcId.set(caseFact.qcRecord.qcId, caseFact)

  if (caseFact.deductionBasis) {
    caseByBasisId.set(caseFact.deductionBasis.basisId, caseFact)
  }

  if (caseFact.disputeCase) {
    caseByDisputeId.set(caseFact.disputeCase.disputeId, caseFact)
  }

  for (const alias of caseFact.qcRecord.routeAliases) {
    qcIdByRouteAlias.set(alias, caseFact.qcRecord.qcId)
  }
}

for (const caseFact of qualityDeductionSharedCaseFacts) {
  indexCaseFact(caseFact)
}

function normalizeRouteKey(routeKey: string): string[] {
  const normalized = routeKey.trim()
  if (!normalized) return []
  return Array.from(new Set([normalized, decodeURIComponent(normalized)]))
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value?: string): number | null {
  if (!value) return null
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function isPastDeadline(deadline?: string, now: Date = new Date()): boolean {
  const deadlineMs = parseDateMs(deadline)
  if (deadlineMs === null) return false
  return deadlineMs < now.getTime()
}

function nextMutationId(prefix: string): string {
  runtimeMutationSequence += 1
  return `${prefix}-${String(runtimeMutationSequence).padStart(4, '0')}`
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function ensureFactoryResponseArrayEntry(factoryResponse: FactoryResponseFact): void {
  if (qualityDeductionSharedFactoryResponses.some((item) => item.responseId === factoryResponse.responseId)) return
  qualityDeductionSharedFactoryResponses.push(factoryResponse)
}

function ensureDisputeArrayEntry(disputeCase: DisputeCaseFact): void {
  if (qualityDeductionSharedDisputeCases.some((item) => item.disputeId === disputeCase.disputeId)) return
  qualityDeductionSharedDisputeCases.push(disputeCase)
}

function updateSettlementImpactTotals(caseFact: QualityDeductionCaseFact): void {
  caseFact.settlementImpact.totalFinancialImpactAmount =
    caseFact.settlementImpact.blockedProcessingFeeAmount + caseFact.settlementImpact.effectiveQualityDeductionAmount
}

function appendQcAuditLog(caseFact: QualityDeductionCaseFact, detail: string, by: string, at: string, action: string): void {
  caseFact.qcRecord.auditLogs = [
    ...caseFact.qcRecord.auditLogs,
    {
      id: nextMutationId(`AL-${caseFact.qcRecord.qcId}`),
      action,
      detail,
      at,
      by,
    },
  ]
}

function appendBasisAuditLog(caseFact: QualityDeductionCaseFact, detail: string, by: string, at: string, action: string): void {
  if (!caseFact.deductionBasis) return
  caseFact.deductionBasis.auditLogs = [
    ...caseFact.deductionBasis.auditLogs,
    {
      id: nextMutationId(`AL-${caseFact.deductionBasis.basisId}`),
      action,
      detail,
      at,
      by,
    },
  ]
}

function createEvidenceAsset(
  qcId: string,
  index: number,
  asset: Pick<QualityEvidenceAsset, 'name' | 'assetType' | 'url'>,
): QualityEvidenceAsset {
  return {
    assetId: `${sanitizeIdPart(qcId)}-DISPUTE-ASSET-${String(index + 1).padStart(2, '0')}`,
    name: asset.name,
    assetType: asset.assetType,
    url: asset.url,
  }
}

export function listQualityDeductionCaseFacts(options: {
  includeLegacy?: boolean
} = {}): QualityDeductionCaseFact[] {
  syncQualityDeductionLifecycle()
  const { includeLegacy = true } = options
  return qualityDeductionSharedCaseFacts.filter((item) => includeLegacy || !item.qcRecord.isLegacy)
}

export function listQualityDeductionQcRecords(options: {
  includeLegacy?: boolean
} = {}): QcRecordFact[] {
  return listQualityDeductionCaseFacts(options).map((item) => item.qcRecord)
}

export function listQualityDeductionFactoryResponses(options: {
  includeLegacy?: boolean
} = {}): FactoryResponseFact[] {
  return listQualityDeductionCaseFacts(options)
    .map((item) => item.factoryResponse)
    .filter((item): item is FactoryResponseFact => item !== null)
}

export function listQualityDeductionDeductionBases(options: {
  includeLegacy?: boolean
} = {}): DeductionBasisFact[] {
  return listQualityDeductionCaseFacts(options)
    .map((item) => item.deductionBasis)
    .filter((item): item is DeductionBasisFact => item !== null)
}

export function listQualityDeductionDisputeCases(options: {
  includeLegacy?: boolean
} = {}): DisputeCaseFact[] {
  return listQualityDeductionCaseFacts(options)
    .map((item) => item.disputeCase)
    .filter((item): item is DisputeCaseFact => item !== null)
}

export function listQualityDeductionSettlementImpacts(options: {
  includeLegacy?: boolean
} = {}): SettlementImpactFact[] {
  return listQualityDeductionCaseFacts(options).map((item) => item.settlementImpact)
}

export function listQualityDeductionSettlementAdjustments(options: {
  includeLegacy?: boolean
} = {}): SettlementAdjustmentFact[] {
  return listQualityDeductionCaseFacts(options)
    .map((item) => item.settlementAdjustment)
    .filter((item): item is SettlementAdjustmentFact => item !== null)
}

export function getQualityDeductionCaseFactByQcId(qcId: string): QualityDeductionCaseFact | null {
  syncQualityDeductionLifecycle()
  return caseByQcId.get(qcId) ?? null
}

export function getQualityDeductionCaseFactByBasisId(basisId: string): QualityDeductionCaseFact | null {
  syncQualityDeductionLifecycle()
  return caseByBasisId.get(basisId) ?? null
}

export function getQualityDeductionCaseFactByDisputeId(disputeId: string): QualityDeductionCaseFact | null {
  syncQualityDeductionLifecycle()
  return caseByDisputeId.get(disputeId) ?? null
}

export function resolveQualityDeductionQcId(routeKey: string): string | null {
  const aliases = normalizeRouteKey(routeKey)
  for (const alias of aliases) {
    const qcId = qcIdByRouteAlias.get(alias)
    if (qcId) return qcId
  }
  return null
}

export function getQualityDeductionCaseFactByRouteKey(routeKey: string): QualityDeductionCaseFact | null {
  const qcId = resolveQualityDeductionQcId(routeKey)
  return qcId ? getQualityDeductionCaseFactByQcId(qcId) : null
}

export function getQualityDeductionQcRecord(qcId: string): QcRecordFact | null {
  return getQualityDeductionCaseFactByQcId(qcId)?.qcRecord ?? null
}

export function getQualityDeductionDeductionBasis(basisId: string): DeductionBasisFact | null {
  return getQualityDeductionCaseFactByBasisId(basisId)?.deductionBasis ?? null
}

export function getQualityDeductionDisputeCase(disputeId: string): DisputeCaseFact | null {
  return getQualityDeductionCaseFactByDisputeId(disputeId)?.disputeCase ?? null
}

export function getQualityDeductionSettlementImpact(qcId: string): SettlementImpactFact | null {
  return getQualityDeductionCaseFactByQcId(qcId)?.settlementImpact ?? null
}

export function getQualityDeductionSettlementAdjustmentByQcId(qcId: string): SettlementAdjustmentFact | null {
  return getQualityDeductionCaseFactByQcId(qcId)?.settlementAdjustment ?? null
}

export function getQualityDeductionCaseStatusByQcId(qcId: string): QualityDeductionCaseStatus | null {
  syncQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  return caseFact ? getQualityDeductionCaseStatus(caseFact) : null
}

export function confirmQualityDeductionFactoryResponse(
  input: QualityDeductionFactoryConfirmInput,
): { ok: true; caseFact: QualityDeductionCaseFact } | { ok: false; message: string } {
  syncQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(input.qcId)
  if (!caseFact) {
    return { ok: false, message: '未找到对应质检记录' }
  }

  const { qcRecord } = caseFact
  if (!caseFact.factoryResponse || caseFact.factoryResponse.factoryResponseStatus !== 'PENDING_RESPONSE') {
    return { ok: false, message: '当前记录不处于待工厂响应状态' }
  }
  if (qcRecord.factoryLiabilityQty <= 0) {
    return { ok: false, message: '当前记录不需要工厂确认处理' }
  }

  const respondedAt = input.respondedAt ?? nowTimestamp()
  caseFact.factoryResponse.factoryResponseStatus = 'CONFIRMED'
  caseFact.factoryResponse.respondedAt = respondedAt
  caseFact.factoryResponse.autoConfirmedAt = undefined
  caseFact.factoryResponse.responderUserName = input.responderUserName
  caseFact.factoryResponse.responseAction = 'CONFIRM'
  caseFact.factoryResponse.responseComment = input.responseComment ?? '工厂已确认当前责任与处理结果'
  caseFact.factoryResponse.isOverdue = isPastDeadline(caseFact.factoryResponse.responseDeadlineAt, new Date(respondedAt.replace(' ', 'T')))
  ensureFactoryResponseArrayEntry(caseFact.factoryResponse)

  const settlementResult = resolveSettlementImpactAfterConfirmation(
    input.qcId,
    respondedAt,
    input.responderUserName,
  )
  if (!settlementResult.ok) {
    return settlementResult
  }

  if (caseFact.deductionBasis && caseFact.deductionBasis.status === 'EFFECTIVE') {
    appendBasisAuditLog(caseFact, '工厂已确认，扣款依据转为生效状态', input.responderUserName, respondedAt, 'FACTORY_CONFIRM_BASIS')
  }

  qcRecord.updatedAt = respondedAt
  appendQcAuditLog(caseFact, '工厂确认处理，记录转入可结算链路', input.responderUserName, respondedAt, 'FACTORY_CONFIRM_RESPONSE')

  return { ok: true, caseFact }
}

export function submitQualityDeductionDispute(
  input: QualityDeductionDisputeSubmissionInput,
): { ok: true; caseFact: QualityDeductionCaseFact } | { ok: false; message: string } {
  syncQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(input.qcId)
  if (!caseFact) {
    return { ok: false, message: '未找到对应质检记录' }
  }

  if (!caseFact.factoryResponse || caseFact.factoryResponse.factoryResponseStatus !== 'PENDING_RESPONSE') {
    return { ok: false, message: '当前记录不允许再发起异议' }
  }
  if (!caseFact.deductionBasis) {
    return { ok: false, message: '缺少扣款依据，暂不可发起异议' }
  }
  if (caseFact.qcRecord.factoryLiabilityQty <= 0) {
    return { ok: false, message: '当前记录不存在工厂责任数量，不能发起异议' }
  }
  if (!input.disputeReasonCode.trim() || !input.disputeReasonName.trim()) {
    return { ok: false, message: '请先填写异议原因' }
  }
  if (!input.disputeDescription.trim()) {
    return { ok: false, message: '请补充异议说明' }
  }
  if (
    caseFact.factoryResponse.responseDeadlineAt &&
    isPastDeadline(caseFact.factoryResponse.responseDeadlineAt, new Date((input.submittedAt ?? nowTimestamp()).replace(' ', 'T')))
  ) {
    return { ok: false, message: '当前记录已超过 48 小时响应时限，系统自动确认后不能再发起异议' }
  }
  if (input.disputeEvidenceAssets.length === 0) {
    return { ok: false, message: '请至少上传 1 个图片或视频证据' }
  }
  if (!input.disputeEvidenceAssets.some((item) => item.assetType === 'IMAGE' || item.assetType === 'VIDEO')) {
    return { ok: false, message: '异议证据必须包含图片或视频' }
  }

  const submittedAt = input.submittedAt ?? nowTimestamp()
  caseFact.factoryResponse.factoryResponseStatus = 'DISPUTED'
  caseFact.factoryResponse.respondedAt = submittedAt
  caseFact.factoryResponse.autoConfirmedAt = undefined
  caseFact.factoryResponse.responderUserName = input.submittedByUserName
  caseFact.factoryResponse.responseAction = 'DISPUTE'
  caseFact.factoryResponse.responseComment = input.disputeDescription
  caseFact.factoryResponse.isOverdue = false
  ensureFactoryResponseArrayEntry(caseFact.factoryResponse)

  const disputeId =
    caseFact.disputeCase?.disputeId ?? `QCD-${sanitizeIdPart(caseFact.qcRecord.qcId)}`
  const nextEvidenceAssets = input.disputeEvidenceAssets.map((item, index) =>
    createEvidenceAsset(caseFact.qcRecord.qcId, index, item),
  )

  const disputeCase: DisputeCaseFact = {
    disputeId,
    qcId: caseFact.qcRecord.qcId,
    basisId: caseFact.deductionBasis.basisId,
    status: 'PENDING_REVIEW',
    disputeReasonCode: input.disputeReasonCode.trim(),
    disputeReasonName: input.disputeReasonName.trim(),
    disputeDescription: input.disputeDescription.trim(),
    disputeEvidenceAssets: nextEvidenceAssets,
    submittedAt,
    submittedByUserName: input.submittedByUserName,
    reviewerUserName: undefined,
    adjudicatedAt: undefined,
    adjudicationComment: undefined,
    requestedAmount: caseFact.deductionBasis.proposedQualityDeductionAmount,
    adjudicatedAmount: undefined,
  }

  caseFact.disputeCase = disputeCase
  ensureDisputeArrayEntry(disputeCase)
  caseByDisputeId.set(disputeId, caseFact)

  caseFact.settlementImpact.status = 'BLOCKED'
  caseFact.settlementImpact.blockedSettlementQty =
    caseFact.settlementImpact.blockedSettlementQty || caseFact.qcRecord.factoryLiabilityQty
  caseFact.settlementImpact.blockedProcessingFeeAmount =
    caseFact.deductionBasis.blockedProcessingFeeAmount
  caseFact.settlementImpact.effectiveQualityDeductionAmount =
    caseFact.deductionBasis.effectiveQualityDeductionAmount
  caseFact.settlementImpact.summary = '工厂已发起异议，结算保持冻结，待平台处理'
  caseFact.settlementImpact.eligibleAt = undefined
  updateSettlementImpactTotals(caseFact)

  if (caseFact.deductionBasis.status === 'EFFECTIVE') {
    caseFact.deductionBasis.status = 'GENERATED'
  }
  caseFact.deductionBasis.updatedAt = submittedAt
  caseFact.deductionBasis.updatedBy = input.submittedByUserName
  appendBasisAuditLog(caseFact, '工厂发起异议，扣款依据进入待平台复核', input.submittedByUserName, submittedAt, 'FACTORY_SUBMIT_DISPUTE')

  caseFact.qcRecord.updatedAt = submittedAt
  appendQcAuditLog(caseFact, `工厂发起异议：${input.disputeReasonName.trim()}`, input.submittedByUserName, submittedAt, 'FACTORY_SUBMIT_DISPUTE')

  return { ok: true, caseFact }
}

export function validateQualityDeductionRepository(): QualityDeductionValidationIssue[] {
  return validateQualityDeductionSharedFacts()
}

export {
  qualityDeductionSharedCaseFacts,
  qualityDeductionSharedDeductionBases,
  qualityDeductionSharedDisputeCases,
  qualityDeductionSharedFactoryResponses,
  qualityDeductionSharedQcRecords,
  qualityDeductionSharedSettlementAdjustments,
  qualityDeductionSharedSettlementImpacts,
}
