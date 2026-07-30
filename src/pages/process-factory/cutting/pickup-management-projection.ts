import type {
  PickupNodeProjection,
  PickupNodeSourceLocation,
  PickupSession,
} from '../../../data/fcs/cutting/pickup-node-domain.ts'
import {
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  type MaterialPrepOrderProjection,
  type MaterialPrepLine,
} from '../../../data/fcs/cutting/production-material-prep.ts'
import {
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
  type PlatformProcessResultView,
} from '../../../data/fcs/platform-process-result-view.ts'
import {
  listSupplementRecords,
  type SupplementMaterialDemand,
  type SupplementRecord,
} from './supplement-management.ts'

export type PickupListKind = 'READY' | 'INCOMPLETE' | 'HISTORY'
export type PickupDemandSource = 'NORMAL' | 'SUPPLEMENT'
export type PickupProcessRoute = 'NONE' | 'DYE' | 'DYE_PRINT'
export type PickupCarrierType = 'WAREHOUSE_LOCATIONS' | 'PALLET'
export type PickupReadySource = 'DIRECT_READY' | 'UPGRADED_FROM_INCOMPLETE'
export type PickupHistoryPath = 'READY_PICKUP' | 'INCOMPLETE_PICKUP'
export type PickupFinalResult = 'ALL_PICKED' | 'NOT_ALL_PICKED' | 'NEW_SUPPLEMENT_WAIT_PICKUP'

export interface PickupMaterialDemandRow {
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
  requiredQty: number
  preparedQty: number
  pickedQty: number
  remainingPickupQty: number
  currentAvailableQty: number
  currentLocations: PickupNodeSourceLocation[]
}

export interface PickupOrderGroup {
  productionOrderId: string
  productionOrderNo: string
  prepOrderId: string
  prepOrderNo: string
  listKind: PickupListKind
  materialRows: PickupMaterialDemandRow[]
  carrierType: PickupCarrierType
  palletId: string
  palletDisplayLabel: string
  readySource: PickupReadySource | null
  historyPath: PickupHistoryPath | null
  finalResult: PickupFinalResult | null
  pickupSessionCount: number
  latestPickedAt: string
  pickupNodeId: string
  pickupNodeVersion: number
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

export type ProcessResultCandidate = Pick<
  PlatformProcessResultView,
  'completedObjectQty' | 'qtyUnit' | 'platformStatusCode'
>

export interface PickupProcessResults {
  dyeResults: PlatformProcessResultView[]
  printResults: PlatformProcessResultView[]
}

export function resolvePickupRequiredQty(input: {
  plannedQty: number
  unit: string
  processRoute: PickupProcessRoute
  dyeResult?: ProcessResultCandidate
  printResult?: ProcessResultCandidate
}): { qty: number; basisLabel: string } {
  if (input.processRoute === 'NONE') {
    return {
      qty: Number.isFinite(input.plannedQty) ? roundQty(Math.max(input.plannedQty, 0)) : 0,
      basisLabel: '按计划数量',
    }
  }

  const processName = input.processRoute === 'DYE' ? '染色' : '印花'
  const result = input.processRoute === 'DYE' ? input.dyeResult : input.printResult
  if (!result) {
    return { qty: 0, basisLabel: `等待${processName}一次性完成` }
  }
  if (result.platformStatusCode !== 'COMPLETED') {
    return { qty: 0, basisLabel: `等待${processName}一次性完成` }
  }
  if (!Number.isFinite(result.completedObjectQty) || result.completedObjectQty < 0) {
    return { qty: 0, basisLabel: `${processName}加工完成数量异常` }
  }
  if (result.qtyUnit !== input.unit) {
    return { qty: 0, basisLabel: `${processName}加工完成单位不一致` }
  }
  if (result.completedObjectQty === 0) {
    return { qty: 0, basisLabel: `等待${processName}一次性完成` }
  }
  return {
    qty: roundQty(result.completedObjectQty),
    basisLabel: `按${processName}一次性完成数量`,
  }
}

function mobileTaskLinkHasExactReference(mobileTaskLink: string, reference: string): boolean {
  if (!mobileTaskLink || !reference) return false
  try {
    const url = new URL(mobileTaskLink, 'https://higood.local')
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const encodedTaskId = pathSegments.at(-1) ?? ''
    const taskId = decodeURIComponent(encodedTaskId)
    return taskId === reference
      || Array.from(url.searchParams.values()).some((value) => value === reference)
  } catch {
    return false
  }
}

function includesReference(view: PlatformProcessResultView, reference: string): boolean {
  if (!reference) return false
  return view.sourceId === reference
    || view.workOrderNo === reference
    || mobileTaskLinkHasExactReference(view.mobileTaskLink, reference)
}

export function resolveNormalProcessResult(
  line: MaterialPrepLine,
  productionOrderNo: string,
  processType: 'DYE' | 'PRINT',
  results: PlatformProcessResultView[],
): PlatformProcessResultView | undefined {
  const candidates = results.filter((view) =>
    view.processType === processType && view.productionOrderNo === productionOrderNo
  )
  if (!candidates.length) return undefined

  const scored = candidates.map((view) => {
    let score = includesReference(view, line.upstreamDocumentNo) ? 4 : 0
    for (const taskLink of line.taskLinks) {
      if (includesReference(view, taskLink.taskId)) score = Math.max(score, 3)
      if (includesReference(view, taskLink.taskNo)) score = Math.max(score, 3)
    }
    return { view, score }
  })
  const bestScore = Math.max(...scored.map((candidate) => candidate.score))
  if (bestScore <= 0) return undefined
  const bestMatches = scored.filter((candidate) => candidate.score === bestScore)
  return bestMatches.length === 1 ? bestMatches[0].view : undefined
}

function resolveSupplementProcessResult(
  record: SupplementRecord,
  demand: SupplementMaterialDemand,
  processType: 'DYE' | 'PRINT',
  results: PlatformProcessResultView[],
): PlatformProcessResultView | undefined {
  const refs = record.processWorkOrderRefs.filter((ref) =>
    ref.processType === processType && ref.materialSku === demand.materialSku
  )
  if (refs.length !== 1) return undefined
  const matches = results.filter((view) => view.sourceId === refs[0].workOrderId)
  return matches.length === 1 ? matches[0] : undefined
}

export function buildSupplementMaterialRows(
  records: SupplementRecord[],
  processResults: PickupProcessResults,
): Map<string, PickupMaterialDemandRow[]> {
  const rowsByProductionOrder = new Map<string, PickupMaterialDemandRow[]>()
  const confirmedRecords = records
    .filter((record) => record.status === '已确认')
    .sort((left, right) =>
      left.draft.productionOrderId.localeCompare(right.draft.productionOrderId, 'zh-CN')
      || left.createdAt.localeCompare(right.createdAt)
      || left.recordNo.localeCompare(right.recordNo, 'zh-CN')
    )

  for (const record of confirmedRecords) {
    const rows = rowsByProductionOrder.get(record.draft.productionOrderId) ?? []
    const demands = [...record.draft.materialDemands].sort((left, right) =>
      left.materialPatternMappingId.localeCompare(right.materialPatternMappingId, 'zh-CN')
    )
    for (const demand of demands) {
      const processRoute = derivePickupProcessRoute({
        printRequired: demand.printRequired,
        dyeRequired: demand.dyeRequired,
      })
      const resolved = resolvePickupRequiredQty({
        plannedQty: demand.requiredQty,
        unit: demand.unit,
        processRoute,
        dyeResult: resolveSupplementProcessResult(record, demand, 'DYE', processResults.dyeResults),
        printResult: resolveSupplementProcessResult(record, demand, 'PRINT', processResults.printResults),
      })
      rows.push({
        demandLineId: `SUPPLEMENT:${record.id}:${demand.materialPatternMappingId}`,
        demandSource: 'SUPPLEMENT',
        demandSourceNo: record.recordNo,
        demandSequence: rows.length + 1,
        demandCreatedAt: record.createdAt,
        supplementReason: [record.draft.reason, record.draft.reasonDetail].filter(Boolean).join('：'),
        materialSku: demand.materialSku,
        materialName: demand.materialName,
        materialImageUrl: demand.materialImageUrl,
        materialType: demand.materialTypeLabel,
        color: '',
        spec: '',
        unit: demand.unit,
        processRoute,
        processBasisLabel: resolved.basisLabel,
        requiredQty: resolved.qty,
        preparedQty: 0,
        pickedQty: 0,
        remainingPickupQty: resolved.qty,
        currentAvailableQty: 0,
        currentLocations: [],
      })
    }
    rowsByProductionOrder.set(record.draft.productionOrderId, rows)
  }
  return rowsByProductionOrder
}

function listMaterialRows(
  projection: MaterialPrepOrderProjection,
  activeNode: PickupNodeProjection | null,
  processResults: PickupProcessResults,
  includeCurrentLocations = true,
): PickupMaterialDemandRow[] {
  return projection.lines.map((line, index) => {
    const nodeItem = activeNode?.items.find((item) => item.prepLineId === line.prepLineId)
    const pickedQty = roundQty(Math.max(line.pickedQty - line.returnedQty, 0))
    const processRoute = derivePickupProcessRoute({ upstreamSourceType: line.upstreamSourceType })
    const resolved = resolvePickupRequiredQty({
      plannedQty: line.requiredQty,
      unit: line.unit,
      processRoute,
      dyeResult: resolveNormalProcessResult(
        line,
        projection.order.productionOrderNo,
        'DYE',
        processResults.dyeResults,
      ),
      printResult: resolveNormalProcessResult(
        line,
        projection.order.productionOrderNo,
        'PRINT',
        processResults.printResults,
      ),
    })
    return {
      demandLineId: line.prepLineId,
      demandSource: 'NORMAL',
      demandSourceNo: line.cutOrderNo,
      demandSequence: index + 1,
      demandCreatedAt: projection.order.createdAt,
      supplementReason: '',
      materialSku: line.materialSku,
      materialName: line.materialName,
      materialImageUrl: line.materialImageUrl,
      materialType: line.materialType,
      color: line.color,
      spec: line.spec,
      unit: line.unit,
      processRoute,
      processBasisLabel: resolved.basisLabel,
      requiredQty: resolved.qty,
      preparedQty: roundQty(Math.max(line.confirmedPrepQty, 0)),
      pickedQty,
      remainingPickupQty: roundQty(Math.max(resolved.qty - pickedQty, 0)),
      currentAvailableQty: roundQty(Math.max(nodeItem?.currentAvailableQty ?? 0, 0)),
      currentLocations: includeCurrentLocations
        ? nodeItem?.sourceLocations.map((location) => ({
            ...location,
            sourcePrepRecordIds: [...location.sourcePrepRecordIds],
          })) ?? []
        : [],
    }
  })
}

function uniqueMaterialRows(rows: PickupMaterialDemandRow[]): PickupMaterialDemandRow[] {
  const byDemandLineId = new Map<string, PickupMaterialDemandRow>()
  rows.forEach((row) => {
    if (!byDemandLineId.has(row.demandLineId)) byDemandLineId.set(row.demandLineId, row)
  })
  return Array.from(byDemandLineId.values())
}

function combineMaterialRows(
  normalRows: PickupMaterialDemandRow[],
  supplementRows: PickupMaterialDemandRow[],
): PickupMaterialDemandRow[] {
  return [...uniqueMaterialRows(normalRows), ...supplementRows].map((row, index) => ({
    ...row,
    demandSequence: index + 1,
  }))
}

function latestSession(sessions: PickupSession[]): PickupSession | null {
  return [...sessions].sort((left, right) =>
    right.pickedAt.localeCompare(left.pickedAt)
    || right.pickupSessionId.localeCompare(left.pickupSessionId)
  )[0] ?? null
}

export function derivePickupHistoryPath(
  nodeTypes: ReadonlyArray<PickupSession['nodeType']>,
): PickupHistoryPath | null {
  if (!nodeTypes.length) return null
  return nodeTypes.some((nodeType) => nodeType === 'INCOMPLETE_PICKABLE')
    ? 'INCOMPLETE_PICKUP'
    : 'READY_PICKUP'
}

function groupProjectionsByProductionOrder(
  projections: MaterialPrepOrderProjection[],
): Map<string, MaterialPrepOrderProjection[]> {
  const grouped = new Map<string, MaterialPrepOrderProjection[]>()
  projections.forEach((projection) => {
    const existing = grouped.get(projection.order.productionOrderId)
    if (existing) existing.push(projection)
    else grouped.set(projection.order.productionOrderId, [projection])
  })
  return grouped
}

function sortGroups(groups: PickupOrderGroup[]): PickupOrderGroup[] {
  return groups.sort((left, right) =>
    left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN')
    || left.productionOrderId.localeCompare(right.productionOrderId, 'zh-CN')
  )
}

export function listPickupOrderGroups(
  listKind: PickupListKind,
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
): PickupOrderGroup[] {
  const projections = listMaterialPrepOrderProjections(storage)
  const activeNodes = listActivePickupNodes(storage)
  const projectionsByProductionOrder = groupProjectionsByProductionOrder(projections)
  const supplementRecords = listSupplementRecords()
  const processResults: PickupProcessResults = {
    dyeResults: listPlatformDyeResultViews(),
    printResults: listPlatformPrintResultViews(),
  }
  const supplementRowsByProductionOrder = buildSupplementMaterialRows(supplementRecords, processResults)

  if (listKind !== 'HISTORY') {
    const expectedNodeType = listKind === 'READY' ? 'READY_TO_PICKUP' : 'INCOMPLETE_PICKABLE'
    const groups = activeNodes
      .filter((node) => node.nodeType === expectedNodeType)
      .flatMap((node): PickupOrderGroup[] => {
        const matchingProjections = projectionsByProductionOrder.get(node.productionOrderId) ?? []
        const projection = matchingProjections.find((row) => row.order.prepOrderId === node.prepOrderId)
        if (!projection) return []
        const sessions = matchingProjections.flatMap((row) => row.pickupSessions)
        const latest = latestSession(sessions)
        return [{
          productionOrderId: node.productionOrderId,
          productionOrderNo: node.productionOrderNo,
          prepOrderId: node.prepOrderId,
          prepOrderNo: node.prepOrderNo,
          listKind,
          materialRows: combineMaterialRows(
            matchingProjections.flatMap((row) =>
              listMaterialRows(
                row,
                row.order.prepOrderId === node.prepOrderId ? node : null,
                processResults,
                listKind === 'INCOMPLETE',
              )
            ),
            supplementRowsByProductionOrder.get(node.productionOrderId) ?? [],
          ),
          carrierType: listKind === 'READY' ? 'PALLET' : 'WAREHOUSE_LOCATIONS',
          palletId: '',
          palletDisplayLabel: '',
          readySource: null,
          historyPath: null,
          finalResult: null,
          pickupSessionCount: sessions.length,
          latestPickedAt: latest?.pickedAt ?? '',
          pickupNodeId: node.nodeId,
          pickupNodeVersion: node.version,
        }]
      })
    return sortGroups(Array.from(
      new Map(groups.map((group) => [group.productionOrderId, group])).values(),
    ))
  }

  const activeNodeByProductionOrder = new Map(
    activeNodes.map((node) => [node.productionOrderId, node]),
  )
  const historyGroups: PickupOrderGroup[] = []
  projectionsByProductionOrder.forEach((matchingProjections, productionOrderId) => {
    const sessions = matchingProjections.flatMap((projection) => projection.pickupSessions)
    if (!sessions.length) return
    const latest = latestSession(sessions)
    if (!latest) return
    const firstProjection = matchingProjections[0]
    const activeNode = activeNodeByProductionOrder.get(productionOrderId) ?? null
    const materialRows = combineMaterialRows(
      matchingProjections.flatMap((projection) =>
        listMaterialRows(
          projection,
          activeNode?.prepOrderId === projection.order.prepOrderId ? activeNode : null,
          processResults,
        )
      ),
      supplementRowsByProductionOrder.get(productionOrderId) ?? [],
    )
    historyGroups.push({
      productionOrderId,
      productionOrderNo: firstProjection.order.productionOrderNo,
      prepOrderId: firstProjection.order.prepOrderId,
      prepOrderNo: firstProjection.order.prepOrderNo,
      listKind,
      materialRows,
      carrierType: latest.nodeType === 'READY_TO_PICKUP' ? 'PALLET' : 'WAREHOUSE_LOCATIONS',
      palletId: '',
      palletDisplayLabel: '',
      readySource: null,
      historyPath: derivePickupHistoryPath(sessions.map((session) => session.nodeType)),
      finalResult: materialRows.every((row) => row.pickedQty >= row.requiredQty)
        ? 'ALL_PICKED'
        : 'NOT_ALL_PICKED',
      pickupSessionCount: sessions.length,
      latestPickedAt: latest.pickedAt,
      pickupNodeId: activeNode?.nodeId ?? '',
      pickupNodeVersion: activeNode?.version ?? 0,
    })
  })
  return sortGroups(historyGroups)
}
