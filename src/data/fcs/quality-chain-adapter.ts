import { applyQualitySeedBootstrap } from './store-domain-quality-bootstrap'
import {
  initialDeductionBasisItems,
  initialQualityInspections,
  initialReturnInboundBatches,
} from './store-domain-quality-seeds'
import type { DeductionBasisItem, QualityInspection } from './store-domain-quality-types'
import {
  RETURN_INBOUND_QC_CHAIN_SCENARIOS,
  type ReturnInboundQualityDisputeFact,
  type ReturnInboundSettlementImpactFact,
  type SettlementImpactStatus,
} from './return-inbound-quality-chain-facts'

applyQualitySeedBootstrap()

export interface QcChainFact {
  qc: QualityInspection
  basisItems: DeductionBasisItem[]
  dispute: ReturnInboundQualityDisputeFact | null
  settlementImpact: ReturnInboundSettlementImpactFact
  evidenceCount: number
  deductionAmountCny: number
}

const disputeFacts = RETURN_INBOUND_QC_CHAIN_SCENARIOS
  .map((scenario) => scenario.dispute ?? null)
  .filter((item): item is ReturnInboundQualityDisputeFact => item !== null)

const settlementImpactFacts = RETURN_INBOUND_QC_CHAIN_SCENARIOS.map((scenario) => scenario.settlementImpact)

function extractQcIdFromHref(href?: string): string | null {
  if (!href) return null
  const match = /\/fcs\/quality\/qc-records\/([^/?#]+)/.exec(href)
  return match ? decodeURIComponent(match[1]) : null
}

function getAllQualityInspections(): QualityInspection[] {
  return initialQualityInspections
}

function getAllBasisItems(): DeductionBasisItem[] {
  return initialDeductionBasisItems
}

function resolveAliasCandidates(routeKey: string): string[] {
  const normalized = routeKey.trim()
  if (!normalized) return []
  return Array.from(new Set([normalized, decodeURIComponent(normalized)]))
}

export function getQcById(qcId: string): QualityInspection | null {
  return getAllQualityInspections().find((item) => item.qcId === qcId) ?? null
}

export function resolveQcIdFromRouteKey(routeKey: string): string | null {
  const aliasCandidates = resolveAliasCandidates(routeKey)
  if (aliasCandidates.length === 0) return null

  const inspections = getAllQualityInspections()
  const batches = initialReturnInboundBatches

  for (const candidate of aliasCandidates) {
    const direct = inspections.find((item) => item.qcId === candidate)
    if (direct) return direct.qcId
  }

  for (const candidate of aliasCandidates) {
    const direct = inspections.find(
      (item) =>
        item.returnBatchId === candidate ||
        item.refId === candidate ||
        item.sourceBusinessId === candidate ||
        item.sourceOrderId === candidate,
    )
    if (direct) return direct.qcId
  }

  for (const candidate of aliasCandidates) {
    const linkedBatch = batches.find((item) => item.batchId === candidate || item.linkedQcId === candidate)
    if (linkedBatch?.linkedQcId && getQcById(linkedBatch.linkedQcId)) {
      return linkedBatch.linkedQcId
    }
  }

  for (const basis of getAllBasisItems()) {
    const basisCandidates = [basis.sourceRefId, basis.sourceId, extractQcIdFromHref(basis.deepLinks.qcHref)].filter(
      Boolean,
    ) as string[]
    if (!basisCandidates.some((candidate) => aliasCandidates.includes(candidate))) continue

    const deepLinkedQcId = extractQcIdFromHref(basis.deepLinks.qcHref)
    if (deepLinkedQcId && getQcById(deepLinkedQcId)) return deepLinkedQcId

    const exactSource = basis.sourceRefId || basis.sourceId
    if (exactSource && getQcById(exactSource)) return exactSource
  }

  return null
}

export function getQcByRouteKey(routeKey: string): QualityInspection | null {
  const qcId = resolveQcIdFromRouteKey(routeKey)
  return qcId ? getQcById(qcId) : null
}

export function buildQcDetailHref(routeKeyOrQcId: string): string {
  const qcId = resolveQcIdFromRouteKey(routeKeyOrQcId) ?? routeKeyOrQcId
  return `/fcs/quality/qc-records/${encodeURIComponent(qcId)}`
}

function resolveBasisQcId(basis: DeductionBasisItem): string | null {
  const aliasCandidates = [basis.sourceRefId, basis.sourceId, extractQcIdFromHref(basis.deepLinks.qcHref)].filter(
    Boolean,
  ) as string[]

  for (const candidate of aliasCandidates) {
    const qcId = resolveQcIdFromRouteKey(candidate)
    if (qcId) return qcId
  }

  return null
}

export function getLinkedBasisItems(qcId: string): DeductionBasisItem[] {
  return getAllBasisItems().filter((item) => resolveBasisQcId(item) === qcId)
}

export function getQualityDisputeByQcId(qcId: string): ReturnInboundQualityDisputeFact | null {
  return disputeFacts.find((item) => item.qcId === qcId) ?? null
}

function createFallbackSettlementImpact(qc: QualityInspection, basisItems: DeductionBasisItem[]): ReturnInboundSettlementImpactFact {
  let status: SettlementImpactStatus = 'NO_IMPACT'
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

export function getSettlementImpactByQcId(qcId: string): ReturnInboundSettlementImpactFact {
  const scenarioImpact = settlementImpactFacts.find((item) => item.qcId === qcId)
  if (scenarioImpact) return scenarioImpact

  const qc = getQcById(qcId)
  if (!qc) {
    return {
      qcId,
      factoryId: '',
      batchId: '',
      status: 'NO_IMPACT',
      summary: '未找到质检记录',
    }
  }

  return createFallbackSettlementImpact(qc, getLinkedBasisItems(qcId))
}

export function getCanonicalQcHrefForBasis(basis: DeductionBasisItem): string | null {
  const resolvedQcId = resolveBasisQcId(basis)
  if (!resolvedQcId) return null
  return buildQcDetailHref(resolvedQcId)
}

export function getBasisById(basisId: string): DeductionBasisItem | null {
  return getAllBasisItems().find((item) => item.basisId === basisId) ?? null
}

export function listDeductionBasisLedgerItems(): DeductionBasisItem[] {
  return getAllBasisItems().filter((item) => {
    if (item.sourceType === 'HANDOVER_DIFF') return true
    return Boolean(getCanonicalQcHrefForBasis(item))
  })
}

export function getQcChainFact(qcId: string): QcChainFact | null {
  const qc = getQcById(qcId)
  if (!qc) return null

  const basisItems = getLinkedBasisItems(qcId)
  const dispute = getQualityDisputeByQcId(qcId)
  const settlementImpact = getSettlementImpactByQcId(qcId)
  const evidenceCount = basisItems.reduce((sum, item) => sum + item.evidenceRefs.length, 0)
  const deductionAmountCny = basisItems.reduce((sum, item) => sum + (item.deductionAmountSnapshot ?? 0), 0)

  return {
    qc,
    basisItems,
    dispute,
    settlementImpact,
    evidenceCount,
    deductionAmountCny,
  }
}

export function getQcChainFactByRouteKey(routeKey: string): QcChainFact | null {
  const qcId = resolveQcIdFromRouteKey(routeKey)
  return qcId ? getQcChainFact(qcId) : null
}

export function listQcChainFacts(): QcChainFact[] {
  return getAllQualityInspections()
    .map((item) => getQcChainFact(item.qcId))
    .filter((item): item is QcChainFact => item !== null)
}

export function getSettlementImpactLabel(status: SettlementImpactStatus): string {
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
