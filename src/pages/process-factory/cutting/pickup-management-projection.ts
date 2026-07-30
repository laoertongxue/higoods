import type {
  PickupNodeProjection,
  PickupNodeSourceLocation,
  PickupSession,
} from '../../../data/fcs/cutting/pickup-node-domain.ts'
import {
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  type MaterialPrepOrderProjection,
} from '../../../data/fcs/cutting/production-material-prep.ts'

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
  return Number(Number(value || 0).toFixed(2))
}

function listMaterialRows(
  projection: MaterialPrepOrderProjection,
  activeNode: PickupNodeProjection | null,
  includeCurrentLocations = true,
): PickupMaterialDemandRow[] {
  return projection.lines.map((line, index) => {
    const nodeItem = activeNode?.items.find((item) => item.prepLineId === line.prepLineId)
    const pickedQty = roundQty(Math.max(line.pickedQty - line.returnedQty, 0))
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
      processRoute: 'NONE',
      processBasisLabel: '按计划数量',
      requiredQty: line.requiredQty,
      preparedQty: line.confirmedPrepQty,
      pickedQty,
      remainingPickupQty: roundQty(Math.max(line.requiredQty - pickedQty, 0)),
      currentAvailableQty: nodeItem?.currentAvailableQty ?? 0,
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
          materialRows: uniqueMaterialRows(matchingProjections.flatMap((row) =>
            listMaterialRows(
              row,
              row.order.prepOrderId === node.prepOrderId ? node : null,
              listKind === 'INCOMPLETE',
            )
          )),
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
    const materialRows = uniqueMaterialRows(matchingProjections.flatMap((projection) =>
      listMaterialRows(
        projection,
        activeNode?.prepOrderId === projection.order.prepOrderId ? activeNode : null,
      )
    ))
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
