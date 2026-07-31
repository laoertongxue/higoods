export type PickupNodeType = 'INCOMPLETE_PICKABLE' | 'READY_TO_PICKUP'
export type PickupNodeStatus = 'OPEN' | 'CLOSED'
export type PickupNodeLocationPolicy = 'KEEP_CURRENT_LOCATION' | 'ASSIGN_INCOMPLETE_LOCATION' | 'DIRECT_READY_AREA'

export interface PickupCoverageLine {
  key: string
  unit: string
  requiredQty: number
  lineEffectivePickedQty: number
  effectivePickedQty: number
  currentAvailableQty: number
}

export interface PickupNodeIdentity {
  nodeId: string
  version: number
  nodeType: PickupNodeType
  status: PickupNodeStatus
  locationPolicy: PickupNodeLocationPolicy
}

export interface PickupNodeSourceLocation {
  sourceWarehouseName: string
  sourceWarehouseArea: string
  sourceLocationCode: string
  currentAvailableQty: number
  rollCount: number
  unit: string
  sourcePrepRecordIds: string[]
}

export interface PickupNodeSourceAllocation {
  prepRecordId: string
  prepLineId: string
  currentAvailableQty: number
  rollCount: number
  unit: string
  sourceWarehouseName: string
  sourceWarehouseArea: string
  sourceLocationCode: string
}

export interface PickupNodeItem {
  nodeItemId: string
  prepLineId: string
  sourcePrepRecordIds: string[]
  materialSku: string
  materialName: string
  materialType: string
  materialImageUrl: string
  color: string
  spec: string
  unit: string
  requiredQty: number
  effectivePickedQty: number
  currentAvailableQty: number
  rollCount: number
  sourceWarehouseName: string
  sourceWarehouseArea: string
  sourceLocationCode: string
  sourceLocations: PickupNodeSourceLocation[]
  sourceAllocations: PickupNodeSourceAllocation[]
}

export interface PickupNodeProjection extends PickupNodeIdentity {
  prepOrderId: string
  prepOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sequence: number
  updatedAt: string
  itemCount: number
  items: PickupNodeItem[]
}

export interface PickupSession {
  pickupSessionId: string
  pickupSessionNo: string
  pickupNodeId: string
  pickupNodeVersion: number
  prepOrderId: string
  productionOrderId: string
  nodeType: PickupNodeType
  pickupRecordIds: string[]
  receiverName: string
  pickedAt: string
  toWarehouseArea: string
  toLocationCode: string
  toLocationRefs?: PickupStorageLocationRef[]
  storageFootprint?: PickupStorageFootprint
  status: '本轮已领完'
  warehouseSyncStatus: '已回写' | '回写异常待重试'
  warehouseSyncMessage?: string
  idempotencyKey?: string
  migrationEvidence?: '按累计领料逐行齐套推导' | '旧事实不足，保守按未配齐'
  pickupNodeSnapshot?: PickupNodeProjection
}

export function adjustPickupSessionStorageFootprint(
  session: PickupSession,
  locationRefs: PickupStorageLocationRef[],
  remainingByUnit: Array<{ unit: string; remainingQty: number }>,
): PickupSession {
  if (!session.storageFootprint) throw new Error('当前领料记录没有可调整的存放范围。')
  const remainingMap = new Map(remainingByUnit.map((item) => [item.unit, Number(item.remainingQty)]))
  const unitSummaries = session.storageFootprint.unitSummaries.map((summary) => {
    const remainingQty = remainingMap.has(summary.unit)
      ? Number(remainingMap.get(summary.unit))
      : summary.remainingQty
    if (!Number.isFinite(remainingQty) || remainingQty < 0 || remainingQty > summary.totalQty) {
      throw new Error(`${summary.unit} 剩余数量必须在 0 至 ${summary.totalQty} 之间。`)
    }
    return { ...summary, remainingQty }
  })
  const hasRemaining = unitSummaries.some((summary) => summary.remainingQty > 0)
  if (hasRemaining && !locationRefs.length) throw new Error('仍有剩余物料时必须保留至少一个库位。')
  const uniqueRefs = Array.from(
    new Map(locationRefs.map((location) => [location.locationId, structuredClone(location)])).values(),
  )
  return {
    ...structuredClone(session),
    toWarehouseArea: uniqueRefs[0]?.areaName || session.toWarehouseArea,
    toLocationCode: uniqueRefs[0]?.locationNo || session.toLocationCode,
    toLocationRefs: uniqueRefs,
    storageFootprint: {
      ...structuredClone(session.storageFootprint),
      locationIds: uniqueRefs.map((location) => location.locationId),
      unitSummaries,
    },
  }
}

export interface PickupStorageLocationRef {
  factoryId: string
  warehouseId: string
  warehouseKind: 'WAIT_PROCESS'
  areaId: string
  areaName: string
  shelfId: string
  shelfNo: string
  locationId: string
  locationNo: string
}

export interface PickupStorageFootprint {
  footprintId: string
  sourceType: 'PICKUP_SESSION'
  sourceId: string
  locationIds: string[]
  unitSummaries: Array<{
    unit: string
    totalQty: number
    remainingQty: number
    rollCount: number
  }>
  inboundAt: string
  inboundBy: string
}

export interface PickupNodeSnapshotState {
  nodeId: string
  prepOrderId: string
  sequence: number
  version: number
  fingerprint: string
  updatedAt: string
}

export function derivePickupNodeType(lines: PickupCoverageLine[]): PickupNodeType {
  return lines.length > 0 && lines.every((line) =>
    line.effectivePickedQty + line.currentAvailableQty >= line.requiredQty
  ) ? 'READY_TO_PICKUP' : 'INCOMPLETE_PICKABLE'
}

export function resolvePickupNodeUpdate(input: {
  prepOrderId: string
  nextSequence: number
  existingNode: PickupNodeIdentity | null
  coverageLines: PickupCoverageLine[]
}): PickupNodeIdentity {
  const nodeType = derivePickupNodeType(input.coverageLines)
  if (input.existingNode && input.existingNode.status === 'OPEN') {
    return {
      ...input.existingNode,
      version: input.existingNode.version + 1,
      nodeType,
      locationPolicy: 'KEEP_CURRENT_LOCATION',
    }
  }
  return {
    nodeId: `pickup-node:${input.prepOrderId}:${input.nextSequence}`,
    version: 1,
    nodeType,
    status: 'OPEN',
    locationPolicy: nodeType === 'READY_TO_PICKUP' ? 'DIRECT_READY_AREA' : 'ASSIGN_INCOMPLETE_LOCATION',
  }
}
