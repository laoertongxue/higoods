import type { CuttingRuntimeEvent, AppendCuttingRuntimeEventInput, CuttingRuntimeQtyUnit } from './cutting-runtime-event-ledger.ts'
import type { PickupStorageLocationRef } from './pickup-node-domain.ts'
import type { SpreadingOrder } from '../../../pages/process-factory/cutting/marker-spreading-model.ts'
import { convertCuttingQuantity } from './cutting-quantity-unit.ts'

export interface CuttingMaterialMovementInput {
  operationId: string
  expectedSource: string
  quantity: number
  rollCount: number
  operatorId: string
  operatorName: string
  factoryId: string
}
export interface CuttingIssueSource {
  inbound: CuttingRuntimeEvent
  availableQty: number
  locations: PickupStorageLocationRef[]
  order: SpreadingOrder
  /** Current assignment/source identities are part of the displayed snapshot. */
  sourceIdentity: unknown
}
export const cuttingIssueSourceSnapshot = (source: CuttingIssueSource) => JSON.stringify(source)
function assertInput(input: CuttingMaterialMovementInput) {
  if (!input.operationId.trim() || !input.operatorId.trim() || !input.operatorName.trim() || !input.factoryId.trim()) throw new Error('CUT_actor')
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || Math.abs(input.quantity * 100 - Math.round(input.quantity * 100)) > 1e-7) throw new Error('CUT_movementQuantity')
  if (!Number.isSafeInteger(input.rollCount) || input.rollCount <= 0) throw new Error('CUT_rollCount')
}
function originalUnit(event: CuttingRuntimeEvent): CuttingRuntimeQtyUnit {
  const unit = event.inventoryEffect?.unit
  if (!unit || convertCuttingQuantity(1, unit, '米') === null) throw new Error('CUT_unit')
  return unit
}
function assertLocations(locations: PickupStorageLocationRef[], factoryId: string) {
  const first = locations[0]
  if (!first || new Set(locations.map(ref => ref.locationId)).size !== locations.length || locations.some(ref => ref.factoryId !== factoryId || ref.warehouseKind !== 'WAIT_PROCESS' || ref.warehouseId !== first.warehouseId)) throw new Error('CUT_position')
}

/** One real inbound batch issues to one real bed; quantities retain the inbound unit. */
export function prepareCuttingProcessIssue(source: CuttingIssueSource, input: CuttingMaterialMovementInput, occurredAt: string): AppendCuttingRuntimeEventInput<'待加工仓加工接收'> & { idempotencyKey: string } {
  assertInput(input)
  if (input.expectedSource !== cuttingIssueSourceSnapshot(source)) throw new Error('CUT_changed')
  const event = source.inbound, order = source.order, unit = originalUnit(event)
  assertLocations(source.locations, input.factoryId)
  if (event.eventStatus === '已取消' || event.inventoryEffect?.direction !== 'IN' || event.inventoryEffect.inventoryScope !== '裁床待加工仓'
    || !['中转仓接收', '待加工仓回收入仓'].includes(event.eventType) || !event.refs.cutOrderId || !order.sourceCutOrderIds.includes(event.refs.cutOrderId)
    || !event.refs.productionOrderId || !order.productionOrderIds.includes(event.refs.productionOrderId)
    || !event.material?.materialSku || event.material.materialSku !== order.materialIdentity.materialSku
    || !['WAITING_SPREADING', 'SPREADING'].includes(order.status) || !order.spreadingOrderId || !order.spreadingOrderNo) throw new Error('CUT_spreading')
  if (!Number.isFinite(source.availableQty) || input.quantity > source.availableQty) throw new Error('CUT_issueLimit')
  const id = `cutting-issue:${input.operationId}`, payload = event.payload as Record<string, unknown>
  return {
    eventId: id, idempotencyKey: id, eventType: '待加工仓加工接收', eventSource: 'PDA', occurredAt,
    operatorName: input.operatorName, operatorId: input.operatorId, operatorRole: '现场加工人员',
    refs: { productionOrderId: event.refs.productionOrderId, productionOrderNo: event.refs.productionOrderNo, cutOrderId: event.refs.cutOrderId, cutOrderNo: event.refs.cutOrderNo,
      spreadingOrderId: order.spreadingOrderId, spreadingOrderNo: order.spreadingOrderNo, markerPlanId: order.markerPlanId, markerPlanNo: order.markerPlanNo },
    material: structuredClone(event.material),
    inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'OUT', qty: input.quantity, unit, rollCount: input.rollCount,
      fromWarehouseArea: source.locations.map(ref => ref.areaName).join(' / '), fromLocationCode: source.locations.map(ref => ref.locationNo).join(' / ') },
    payload: { issueRecordId: id, issueRecordNo: `GL-${input.operationId.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}`, spreadingOrderId: order.spreadingOrderId, spreadingOrderNo: order.spreadingOrderNo,
      materialSku: event.material.materialSku, issuedQty: input.quantity, unit, rollCount: input.rollCount, rollNos: [],
      fromWarehouseArea: source.locations.map(ref => ref.areaName).join(' / '), fromLocationCode: source.locations.map(ref => ref.locationNo).join(' / '),
      issuedBy: input.operatorName, issuedAt: occurredAt, purpose: '铺布用料',
      pickupSessionId: typeof payload.pickupSessionId === 'string' ? payload.pickupSessionId : undefined,
      sourceInboundEventIds: [event.eventId], warehouseLocations: structuredClone(source.locations),
      cuttingSource: structuredClone(payload.cuttingSource), receivedBy: event.operatorName, receivedById: event.operatorId },
  }
}

export interface CuttingReturnSource { issue: CuttingRuntimeEvent; returnedQty: number; consumedQty?: number }
export const cuttingReturnSourceSnapshot = (source: CuttingReturnSource) => JSON.stringify(source)
/** The return links its actual issue. A later task reassignment does not move the physical material. */
export function prepareCuttingProcessReturn(source: CuttingReturnSource, locations: PickupStorageLocationRef[], input: CuttingMaterialMovementInput, occurredAt: string): AppendCuttingRuntimeEventInput<'待加工仓回收入仓'> & { idempotencyKey: string } {
  assertInput(input); assertLocations(locations, input.factoryId)
  if (input.expectedSource !== cuttingReturnSourceSnapshot(source)) throw new Error('CUT_changed')
  const issue = source.issue, unit = originalUnit(issue), payload = issue.payload as Record<string, unknown>
  const originalLocations = payload.warehouseLocations as PickupStorageLocationRef[] | undefined
  if (issue.eventType !== '待加工仓加工接收' || issue.eventStatus === '已取消' || issue.inventoryEffect?.direction !== 'OUT'
    || !issue.refs.spreadingOrderId || !issue.refs.cutOrderId || !issue.material?.materialSku
    || !originalLocations?.length || originalLocations.some(ref => ref.factoryId !== input.factoryId || ref.warehouseId !== locations[0].warehouseId)) throw new Error('CUT_changed')
  const consumed = source.consumedQty ?? 0
  if (!Number.isFinite(source.returnedQty) || source.returnedQty < 0 || !Number.isFinite(consumed) || consumed < 0
    || input.quantity > Number((issue.inventoryEffect.qty - source.returnedQty - consumed).toFixed(2))) throw new Error('CUT_returnLimit')
  const id = `cutting-return:${input.operationId}`, first = locations[0]
  return {
    eventId: id, idempotencyKey: id, eventType: '待加工仓回收入仓', eventSource: 'PDA', occurredAt,
    operatorId: input.operatorId, operatorName: input.operatorName, operatorRole: '现场仓管人员', refs: structuredClone(issue.refs), material: structuredClone(issue.material),
    inventoryEffect: { inventoryScope: '裁床待加工仓', direction: 'IN', qty: input.quantity, unit, rollCount: input.rollCount, toWarehouseArea: first.areaName, toLocationCode: first.locationNo },
    payload: { returnRecordId: id, returnRecordNo: `HS-${input.operationId.replace(/[^a-zA-Z0-9]/g, '').slice(-10)}`, spreadingOrderId: issue.refs.spreadingOrderId, spreadingOrderNo: issue.refs.spreadingOrderNo || '',
      sourceIssueEventId: issue.eventId, sourcePickupSessionId: typeof payload.pickupSessionId === 'string' ? payload.pickupSessionId : undefined,
      materialSku: issue.material.materialSku, returnedQty: input.quantity, unit, rollCount: input.rollCount, rollNos: [],
      warehouseArea: first.areaName, locationCode: first.locationNo, returnedBy: input.operatorName, returnedAt: occurredAt, reason: '铺布剩余',
      warehouseLocations: structuredClone(locations), cuttingSource: structuredClone(payload.cuttingSource),
      storageFootprint: { footprintId: id, sourceType: 'PICKUP_SESSION', sourceId: id, locationIds: locations.map(ref => ref.locationId), totalQty: input.quantity, remainingQty: input.quantity, unit, inboundAt: occurredAt, inboundBy: input.operatorName } },
  }
}
