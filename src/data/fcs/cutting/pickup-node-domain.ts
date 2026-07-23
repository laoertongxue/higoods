export type PickupNodeType = 'INCOMPLETE_PICKABLE' | 'READY_TO_PICKUP'
export type PickupNodeStatus = 'OPEN' | 'CLOSED'
export type PickupNodeLocationPolicy = 'KEEP_CURRENT_LOCATION' | 'ASSIGN_INCOMPLETE_LOCATION' | 'DIRECT_READY_AREA'

export interface PickupCoverageLine {
  key: string
  unit: string
  requiredQty: number
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
  status: '本轮已领完'
  warehouseSyncStatus: '已回写' | '回写异常待重试'
  warehouseSyncMessage?: string
  idempotencyKey?: string
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
