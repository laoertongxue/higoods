export type PickupDemandSource = 'NORMAL' | 'SUPPLEMENT'
export type PickupProcessRoute = 'NONE' | 'DYE' | 'DYE_PRINT'

export interface PickupProcessResultFact {
  sourceId: string
  processType: string
  productionOrderNo: string
  workOrderNo: string
  mobileTaskLink: string
  platformStatusCode: string
  completedObjectQty: number
  qtyUnit: string
}

export interface PickupNormalDemandInput {
  prepOrderId: string
  productionOrderId: string
  productionOrderNo: string
  demandLineId: string
  demandSourceNo: string
  demandCreatedAt: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  materialType: string
  color: string
  spec: string
  unit: string
  plannedQty: number
  pickedQty: number
  upstreamSourceType: string
  upstreamDocumentNo: string
  taskRefs: Array<{ taskId: string; taskNo: string }>
}

export interface PickupSupplementDemandInput {
  id: string
  recordNo: string
  status: string
  createdAt: string
  productionOrderId: string
  productionOrderNo: string
  reason: string
  reasonDetail: string
  processWorkOrderRefs: Array<{
    processType: 'PRINT' | 'DYE'
    workOrderId: string
    materialSku: string
  }>
  materialDemands: Array<{
    materialPatternMappingId: string
    materialSku: string
    materialName: string
    materialImageUrl: string
    materialTypeLabel: string
    requiredQty: number
    unit: string
    printRequired: boolean
    dyeRequired: boolean
    color?: string
    spec?: string
  }>
}

export interface PickupDemandPickedFact {
  demandLineId: string
  unit: string
  effectivePickedQty: number
}

export interface PickupDemandFact {
  prepOrderId: string
  productionOrderId: string
  productionOrderNo: string
  demandLineId: string
  demandSource: PickupDemandSource
  demandSourceNo: string
  demandSequence: number
  demandCreatedAt: string
  supplementReason: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  materialType: string
  color: string
  spec: string
  unit: string
  processRoute: PickupProcessRoute
  processBasisLabel: string
  processComplete: boolean
  requiredQty: number
  pickedQty: number
}

export interface PickupDemandFactInput {
  normalDemands: PickupNormalDemandInput[]
  supplementDemands: PickupSupplementDemandInput[]
  pickedFacts: PickupDemandPickedFact[]
  dyeResults: PickupProcessResultFact[]
  printResults: PickupProcessResultFact[]
}

interface ProcessResultResolution {
  result?: PickupProcessResultFact
  ambiguous: boolean
}

function roundQty(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : 0
}

export function derivePickupProcessRoute(input: {
  upstreamSourceType?: string
  printRequired?: boolean
  dyeRequired?: boolean
}): PickupProcessRoute {
  if (input.upstreamSourceType === '印花' || input.printRequired) return 'DYE_PRINT'
  if (input.upstreamSourceType === '染色' || input.dyeRequired) return 'DYE'
  return 'NONE'
}

export function resolvePickupRequiredQty(input: {
  plannedQty: number
  unit: string
  processRoute: PickupProcessRoute
  dyeResult?: Pick<PickupProcessResultFact, 'completedObjectQty' | 'qtyUnit' | 'platformStatusCode'>
  printResult?: Pick<PickupProcessResultFact, 'completedObjectQty' | 'qtyUnit' | 'platformStatusCode'>
  noProcessBasisLabel?: string
}): { qty: number; basisLabel: string; processComplete: boolean } {
  if (input.processRoute === 'NONE') {
    return {
      qty: Number.isFinite(input.plannedQty) ? roundQty(Math.max(input.plannedQty, 0)) : 0,
      basisLabel: input.noProcessBasisLabel || '按计划数量',
      processComplete: true,
    }
  }
  const processName = input.processRoute === 'DYE' ? '染色' : '印花'
  const result = input.processRoute === 'DYE' ? input.dyeResult : input.printResult
  if (!result || result.platformStatusCode !== 'COMPLETED') {
    return { qty: 0, basisLabel: `等待${processName}一次性完成`, processComplete: false }
  }
  if (!Number.isFinite(result.completedObjectQty) || result.completedObjectQty < 0) {
    return { qty: 0, basisLabel: `${processName}加工完成数量异常`, processComplete: false }
  }
  if (result.qtyUnit !== input.unit) {
    return { qty: 0, basisLabel: `${processName}加工完成单位不一致`, processComplete: false }
  }
  if (result.completedObjectQty === 0) {
    return { qty: 0, basisLabel: `等待${processName}一次性完成`, processComplete: false }
  }
  return {
    qty: roundQty(result.completedObjectQty),
    basisLabel: `按${processName}一次性完成数量`,
    processComplete: true,
  }
}

function mobileTaskLinkHasExactReference(mobileTaskLink: string, reference: string): boolean {
  if (!mobileTaskLink || !reference) return false
  try {
    const url = new URL(mobileTaskLink, 'https://higood.local')
    const taskId = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '')
    let hasExactQueryReference = false
    url.searchParams.forEach((value) => {
      if (value === reference) hasExactQueryReference = true
    })
    return taskId === reference
      || hasExactQueryReference
  } catch {
    return false
  }
}

function includesReference(view: PickupProcessResultFact, reference: string): boolean {
  return Boolean(reference) && (
    view.sourceId === reference
    || view.workOrderNo === reference
    || mobileTaskLinkHasExactReference(view.mobileTaskLink, reference)
  )
}

function scoreNormalProcessResult(
  demand: PickupNormalDemandInput,
  view: PickupProcessResultFact,
): number {
  let score = includesReference(view, demand.upstreamDocumentNo) ? 4 : 0
  for (const taskRef of demand.taskRefs) {
    if (includesReference(view, taskRef.taskId) || includesReference(view, taskRef.taskNo)) {
      score = Math.max(score, 3)
    }
  }
  return score
}

export function resolveNormalProcessResult(
  demand: PickupNormalDemandInput,
  processType: 'DYE' | 'PRINT',
  results: PickupProcessResultFact[],
  allNormalDemands: PickupNormalDemandInput[] = [demand],
): ProcessResultResolution {
  const route = derivePickupProcessRoute({ upstreamSourceType: demand.upstreamSourceType })
  const relevantDemands = allNormalDemands.filter((candidate) => {
    if (candidate.productionOrderNo !== demand.productionOrderNo) return false
    const candidateRoute = derivePickupProcessRoute({ upstreamSourceType: candidate.upstreamSourceType })
    return processType === 'DYE' ? candidateRoute === 'DYE' : candidateRoute === 'DYE_PRINT'
  })
  if ((processType === 'DYE' && route !== 'DYE') || (processType === 'PRINT' && route !== 'DYE_PRINT')) {
    return { ambiguous: false }
  }
  const candidates = results.filter((view) =>
    view.processType === processType && view.productionOrderNo === demand.productionOrderNo
  )
  if (candidates.some((view) =>
    relevantDemands.filter((candidate) => scoreNormalProcessResult(candidate, view) > 0).length > 1
  )) return { ambiguous: true }
  const scored = candidates
    .map((view) => ({ view, score: scoreNormalProcessResult(demand, view) }))
    .filter((candidate) => candidate.score > 0)
  if (!scored.length) return { ambiguous: false }
  const bestScore = Math.max(...scored.map((candidate) => candidate.score))
  const bestMatches = scored.filter((candidate) => candidate.score === bestScore)
  return bestMatches.length === 1
    ? { result: bestMatches[0].view, ambiguous: false }
    : { ambiguous: true }
}

function resolveSupplementProcessResult(
  record: PickupSupplementDemandInput,
  demand: PickupSupplementDemandInput['materialDemands'][number],
  processType: 'DYE' | 'PRINT',
  results: PickupProcessResultFact[],
): ProcessResultResolution {
  const relatedMappingIds = new Set(
    record.materialDemands
      .filter((candidate) =>
        candidate.materialSku === demand.materialSku
        && (processType === 'DYE' ? candidate.dyeRequired : candidate.printRequired)
      )
      .map((candidate) => candidate.materialPatternMappingId),
  )
  const refs = record.processWorkOrderRefs.filter((ref) =>
    ref.processType === processType && ref.materialSku === demand.materialSku
  )
  if (relatedMappingIds.size > 1 || refs.length > 1) return { ambiguous: true }
  if (
    relatedMappingIds.size !== 1
    || !relatedMappingIds.has(demand.materialPatternMappingId)
    || refs.length !== 1
  ) return { ambiguous: false }
  const matches = results.filter((view) => view.sourceId === refs[0].workOrderId)
  return matches.length > 1
    ? { ambiguous: true }
    : { result: matches[0], ambiguous: false }
}

export function buildPickupDemandFacts(input: PickupDemandFactInput): PickupDemandFact[] {
  const pickedByLineAndUnit = new Map(
    input.pickedFacts.map((fact) => [
      `${fact.demandLineId}\u0000${fact.unit}`,
      roundQty(Math.max(fact.effectivePickedQty, 0)),
    ]),
  )
  const normalFacts = input.normalDemands.map((demand): PickupDemandFact => {
    const processRoute = derivePickupProcessRoute({ upstreamSourceType: demand.upstreamSourceType })
    const processType = processRoute === 'DYE' ? 'DYE' : processRoute === 'DYE_PRINT' ? 'PRINT' : null
    const resolution = processType
      ? resolveNormalProcessResult(
          demand,
          processType,
          processType === 'DYE' ? input.dyeResults : input.printResults,
          input.normalDemands,
        )
      : { ambiguous: false }
    const processName = processType === 'DYE' ? '染色' : '印花'
    const required = resolution.ambiguous
      ? { qty: 0, basisLabel: `${processName}加工结果归属不唯一`, processComplete: false }
      : resolvePickupRequiredQty({
          plannedQty: demand.plannedQty,
          unit: demand.unit,
          processRoute,
          dyeResult: processType === 'DYE' ? resolution.result : undefined,
          printResult: processType === 'PRINT' ? resolution.result : undefined,
        })
    return {
      ...demand,
      demandSource: 'NORMAL',
      demandSequence: 0,
      supplementReason: '',
      processRoute,
      processBasisLabel: required.basisLabel,
      processComplete: required.processComplete,
      requiredQty: required.qty,
      pickedQty: roundQty(Math.max(demand.pickedQty, 0)),
    }
  })
  const supplementFacts = input.supplementDemands
    .filter((record) => record.status === '已确认')
    .sort((left, right) =>
      left.productionOrderId.localeCompare(right.productionOrderId, 'zh-CN')
      || left.createdAt.localeCompare(right.createdAt)
      || left.recordNo.localeCompare(right.recordNo, 'zh-CN')
    )
    .flatMap((record) =>
      [...record.materialDemands]
        .sort((left, right) =>
          left.materialPatternMappingId.localeCompare(right.materialPatternMappingId, 'zh-CN')
        )
        .map((demand): PickupDemandFact => {
          const demandLineId = `SUPPLEMENT:${record.id}:${demand.materialPatternMappingId}`
          const processRoute = derivePickupProcessRoute({
            printRequired: demand.printRequired,
            dyeRequired: demand.dyeRequired,
          })
          const dyeResolution = resolveSupplementProcessResult(record, demand, 'DYE', input.dyeResults)
          const printResolution = resolveSupplementProcessResult(record, demand, 'PRINT', input.printResults)
          const finalResolution = processRoute === 'DYE' ? dyeResolution : printResolution
          const processName = processRoute === 'DYE' ? '染色' : '印花'
          const required = finalResolution.ambiguous
            ? { qty: 0, basisLabel: `${processName}加工结果归属不唯一`, processComplete: false }
            : resolvePickupRequiredQty({
                plannedQty: demand.requiredQty,
                unit: demand.unit,
                processRoute,
                dyeResult: dyeResolution.result,
                printResult: printResolution.result,
                noProcessBasisLabel: '按补料批准数量',
              })
          return {
            prepOrderId: '',
            productionOrderId: record.productionOrderId,
            productionOrderNo: record.productionOrderNo,
            demandLineId,
            demandSource: 'SUPPLEMENT',
            demandSourceNo: record.recordNo,
            demandSequence: 0,
            demandCreatedAt: record.createdAt,
            supplementReason: [record.reason, record.reasonDetail].filter(Boolean).join('：'),
            materialSku: demand.materialSku,
            materialName: demand.materialName,
            materialImageUrl: demand.materialImageUrl,
            materialType: demand.materialTypeLabel,
            color: demand.color || '',
            spec: demand.spec || '',
            unit: demand.unit,
            processRoute,
            processBasisLabel: required.basisLabel,
            processComplete: required.processComplete,
            requiredQty: required.qty,
            pickedQty: pickedByLineAndUnit.get(`${demandLineId}\u0000${demand.unit}`) ?? 0,
          }
        })
    )
  const sequenceByProductionOrder = new Map<string, number>()
  return [...normalFacts, ...supplementFacts].map((fact) => {
    const sequence = (sequenceByProductionOrder.get(fact.productionOrderId) ?? 0) + 1
    sequenceByProductionOrder.set(fact.productionOrderId, sequence)
    return { ...fact, demandSequence: sequence }
  })
}
