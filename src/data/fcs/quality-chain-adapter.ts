import { applyQualitySeedBootstrap } from './store-domain-quality-bootstrap'
import {
  initialDeductionBasisItems,
  initialQualityInspections,
  initialReturnInboundBatches,
} from './store-domain-quality-seeds'
import type { DeductionBasisItem, QualityInspection } from './store-domain-quality-types'
import {
  getQualityDeductionCaseFactByBasisId,
  getQualityDeductionCaseFactByQcId,
  getQualityDeductionCaseFactByRouteKey,
  listQualityDeductionCaseFacts,
  resolveQualityDeductionQcId,
} from './quality-deduction-repository'
import { syncQualityDeductionLifecycle } from './quality-deduction-lifecycle.ts'
import {
  listDeductionBasisCompatItems,
  toCompatQcChainFact,
  toCompatibilityDeductionBasisItem,
  toCompatibilityQualityInspection,
  type CompatChainDispute,
  type CompatChainSettlementImpact,
  type CompatQcChainFact,
} from './quality-deduction-selectors'

applyQualitySeedBootstrap()

function ensureQualityDeductionLifecycle(): void {
  syncQualityDeductionLifecycle()
}

export interface QcChainFact extends CompatQcChainFact {}

function extractQcIdFromHref(href?: string): string | null {
  if (!href) return null
  const match = /\/fcs\/quality\/qc-records\/([^/?#]+)/.exec(href)
  return match ? decodeURIComponent(match[1]) : null
}

function resolveAliasCandidates(routeKey: string): string[] {
  const normalized = routeKey.trim()
  if (!normalized) return []
  return Array.from(new Set([normalized, decodeURIComponent(normalized)]))
}

function getLegacyQcById(qcId: string): QualityInspection | null {
  return initialQualityInspections.find((item) => item.qcId === qcId) ?? null
}

function getLegacyBasisById(basisId: string): DeductionBasisItem | null {
  return initialDeductionBasisItems.find((item) => item.basisId === basisId) ?? null
}

function resolveLegacyQcIdFromRouteKey(routeKey: string): string | null {
  const aliasCandidates = resolveAliasCandidates(routeKey)
  if (aliasCandidates.length === 0) return null

  for (const candidate of aliasCandidates) {
    const direct = initialQualityInspections.find((item) => item.qcId === candidate)
    if (direct) return direct.qcId
  }

  for (const candidate of aliasCandidates) {
    const direct = initialQualityInspections.find(
      (item) =>
        item.returnBatchId === candidate ||
        item.refId === candidate ||
        item.sourceBusinessId === candidate ||
        item.sourceOrderId === candidate,
    )
    if (direct) return direct.qcId
  }

  for (const candidate of aliasCandidates) {
    const linkedBatch = initialReturnInboundBatches.find((item) => item.batchId === candidate || item.linkedQcId === candidate)
    if (linkedBatch?.linkedQcId && getLegacyQcById(linkedBatch.linkedQcId)) {
      return linkedBatch.linkedQcId
    }
  }

  for (const basis of initialDeductionBasisItems) {
    const basisCandidates = [basis.sourceRefId, basis.sourceId, extractQcIdFromHref(basis.deepLinks.qcHref)].filter(
      Boolean,
    ) as string[]
    if (!basisCandidates.some((candidate) => aliasCandidates.includes(candidate))) continue

    const deepLinkedQcId = extractQcIdFromHref(basis.deepLinks.qcHref)
    if (deepLinkedQcId && getLegacyQcById(deepLinkedQcId)) return deepLinkedQcId

    const exactSource = basis.sourceRefId || basis.sourceId
    if (exactSource && getLegacyQcById(exactSource)) return exactSource
  }

  return null
}

function createFallbackSettlementImpact(
  qc: QualityInspection,
  basisItems: DeductionBasisItem[],
): CompatChainSettlementImpact {
  let status: CompatChainSettlementImpact['status'] = 'NO_IMPACT'
  let summary = '无扣款，不影响结算'

  if (basisItems.some((item) => item.status === 'DISPUTED')) {
    status = 'PENDING_ARBITRATION'
    summary = '争议中，当前冻结'
  } else if (basisItems.some((item) => item.status === 'VOID' || item.arbitrationResult === 'VOID_DEDUCTION')) {
    status = 'NO_IMPACT'
    summary =
      basisItems.find((item) => item.summary?.includes('归档'))?.summary ||
      '扣款已作废，不再影响结算'
  } else if (basisItems.some((item) => item.settlementReady === true)) {
    const settled = basisItems.some((item) => /已结算|已扣回|扣回/.test(item.summary ?? ''))
    status = settled ? 'SETTLED' : 'READY'
    summary = settled ? '已计入历史结算' : qc.status === 'CLOSED' ? '已结案，可进入结算' : '已回写，可进入结算'
  } else if (basisItems.length > 0) {
    status = 'FROZEN'
    summary = basisItems.find((item) => item.settlementFreezeReason)?.settlementFreezeReason || '等待上游处理'
  } else if (qc.result === 'PASS' && qc.status === 'CLOSED') {
    status = 'READY'
    summary = '质检结案，可进入结算'
  }

  return {
    qcId: qc.qcId,
    basisId: basisItems[0]?.basisId,
    factoryId: qc.returnFactoryId ?? basisItems[0]?.factoryId ?? '',
    batchId: qc.returnBatchId ?? qc.refId,
    status,
    summary,
  }
}

function getLegacyLinkedBasisItems(qcId: string): DeductionBasisItem[] {
  return initialDeductionBasisItems.filter((item) => {
    const candidates = [item.sourceRefId, item.sourceId, extractQcIdFromHref(item.deepLinks.qcHref)].filter(Boolean)
    return candidates.includes(qcId)
  })
}

function getLegacyChainFact(qcId: string): QcChainFact | null {
  const qc = getLegacyQcById(qcId)
  if (!qc) return null

  const basisItems = getLegacyLinkedBasisItems(qcId)
  const dispute = null
  const settlementImpact = createFallbackSettlementImpact(qc, basisItems)
  const evidenceCount = basisItems.reduce((sum, item) => sum + item.evidenceRefs.length, 0)
  const deductionAmountCny = basisItems.reduce((sum, item) => sum + (item.deductionAmountSnapshot ?? 0), 0)

  return {
    qc,
    basisItems,
    dispute,
    settlementImpact,
    evidenceCount,
    deductionAmountCny,
    factoryResponse: null,
    deductionBasis: null,
    disputeCase: null,
    settlementAdjustment: null,
    caseStatus: 'NO_ACTION',
  }
}

export function getQcById(qcId: string): QualityInspection | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  if (caseFact) return toCompatibilityQualityInspection(caseFact)
  return getLegacyQcById(qcId)
}

export function resolveQcIdFromRouteKey(routeKey: string): string | null {
  return resolveQualityDeductionQcId(routeKey) ?? resolveLegacyQcIdFromRouteKey(routeKey)
}

export function getQcByRouteKey(routeKey: string): QualityInspection | null {
  ensureQualityDeductionLifecycle()
  const qcId = resolveQcIdFromRouteKey(routeKey)
  return qcId ? getQcById(qcId) : null
}

export function buildQcDetailHref(routeKeyOrQcId: string): string {
  const qcId = resolveQcIdFromRouteKey(routeKeyOrQcId) ?? routeKeyOrQcId
  return `/fcs/quality/qc-records/${encodeURIComponent(qcId)}`
}

export function getLinkedBasisItems(qcId: string): DeductionBasisItem[] {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  if (caseFact) {
    return caseFact.deductionBasis ? [toCompatibilityDeductionBasisItem(caseFact)!] : []
  }
  return getLegacyLinkedBasisItems(qcId)
}

export function getQualityDisputeByQcId(qcId: string): CompatChainDispute | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  return caseFact ? toCompatQcChainFact(caseFact).dispute : null
}

export function getSettlementImpactByQcId(qcId: string): CompatChainSettlementImpact {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  if (caseFact) return toCompatQcChainFact(caseFact).settlementImpact

  const qc = getLegacyQcById(qcId)
  if (!qc) {
    return {
      qcId,
      factoryId: '',
      batchId: '',
      status: 'NO_IMPACT',
      summary: '未找到质检记录',
    }
  }

  return createFallbackSettlementImpact(qc, getLegacyLinkedBasisItems(qcId))
}

export function getCanonicalQcHrefForBasis(basis: DeductionBasisItem): string | null {
  const qcId =
    resolveQcIdFromRouteKey(basis.sourceRefId) ??
    (basis.sourceId ? resolveQcIdFromRouteKey(basis.sourceId) : null) ??
    extractQcIdFromHref(basis.deepLinks.qcHref)

  return qcId ? buildQcDetailHref(qcId) : null
}

export function getBasisById(basisId: string): DeductionBasisItem | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByRouteKey(basisId) ?? getQualityDeductionCaseFactByBasisId(basisId)
  if (caseFact) {
    return caseFact.deductionBasis ? toCompatibilityDeductionBasisItem(caseFact) : null
  }
  return getLegacyBasisById(basisId)
}

export function listDeductionBasisLedgerItems(): DeductionBasisItem[] {
  ensureQualityDeductionLifecycle()
  const shared = listDeductionBasisCompatItems({ includeLegacy: true })
  const sharedBasisIds = new Set(shared.map((item) => item.basisId))
  const fallback = initialDeductionBasisItems.filter((item) => {
    if (sharedBasisIds.has(item.basisId)) return false
    if (item.sourceType === 'HANDOVER_DIFF') return true
    return Boolean(getCanonicalQcHrefForBasis(item))
  })
  return [...shared, ...fallback]
}

export function getQcChainFact(qcId: string): QcChainFact | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByQcId(qcId)
  if (caseFact) return toCompatQcChainFact(caseFact)
  return getLegacyChainFact(qcId)
}

export function getQcChainFactByRouteKey(routeKey: string): QcChainFact | null {
  ensureQualityDeductionLifecycle()
  const caseFact = getQualityDeductionCaseFactByRouteKey(routeKey)
  if (caseFact) return toCompatQcChainFact(caseFact)
  const qcId = resolveLegacyQcIdFromRouteKey(routeKey)
  return qcId ? getLegacyChainFact(qcId) : null
}

export function listQcChainFacts(): QcChainFact[] {
  ensureQualityDeductionLifecycle()
  return listQualityDeductionCaseFacts({ includeLegacy: true }).map((item) => toCompatQcChainFact(item))
}

export function getSettlementImpactLabel(status: CompatChainSettlementImpact['status']): string {
  switch (status) {
    case 'READY':
      return '可结算'
    case 'SETTLED':
      return '已结算'
    case 'PENDING_ARBITRATION':
      return '待仲裁'
    case 'FROZEN':
      return '冻结中'
    default:
      return '不影响'
  }
}
