import { adjustWoolWarehouseStock, transferWoolWarehouseStock, type AdjustWoolWarehouseStockInput, type TransferWoolWarehouseStockInput } from '../../data/fcs/wool-domain/commands.ts'
import { WOOL_DEFAULT_WAREHOUSE_BY_LOCATION, type WoolCommandReceiptValue, type WoolWarehouseFlow } from '../../data/fcs/wool-domain/types.ts'
import { normalizeWoolBatchNo } from '../../data/fcs/wool-domain/warehouse-ledger.ts'
import { runWoolRecordCommand } from '../../data/fcs/wool-domain/store.ts'
import { getFactoryReceiptLocations } from '../../data/fcs/factory-receiving.ts'
import { listFactoryInternalWarehouses, resolveEnabledFactoryWarehouseLocation } from '../../data/fcs/factory-internal-warehouse-locations.ts'
import type { FactoryPdaUser } from '../../data/fcs/store-domain-pda.ts'
import { assertCentralWoolActor, prepareCentralWool } from './wool-model.ts'
import { centralWoolWarehouseFacts, centralWoolStockSource, type CentralWoolStock } from './wool-warehouse-model.ts'

export type WoolStockPosition = NonNullable<ReturnType<typeof resolveEnabledFactoryWarehouseLocation>>
export type WoolStockOperationKind = 'adjust' | 'transfer' | 'transferBack'
export const woolStockPositionKey = (warehouseId: string, locationId: string) => JSON.stringify([warehouseId, locationId])
export function centralWoolStockTargets(row: CentralWoolStock): WoolStockPosition[] {
  if (!row.order) return []
  if (row.stock.physicalLocationId) return getFactoryReceiptLocations(row.order.factoryId)
    .filter(p => p.warehouse.warehouseId !== row.stock.physicalWarehouseId || p.location.locationId !== row.stock.physicalLocationId)
  // Same enabled public-position dictionary as the original Web. It is not
  // limited to the current factory: moving stock does not confirm a handover.
  return listFactoryInternalWarehouses().filter(w => w.isEnabled).flatMap(w => w.areaList
    .filter(a => a.status === 'AVAILABLE').flatMap(a => a.shelfList.filter(s => s.status === 'AVAILABLE')
      .flatMap(s => s.locationList.filter(l => l.status === 'AVAILABLE').map(l => ({ warehouse: w, area: a, shelf: s, location: l })))))
}
function sameObject(a: WoolWarehouseFlow, b: WoolWarehouseFlow) {
  return a.woolOrderId === b.woolOrderId && a.objectSkuCode === b.objectSkuCode
    && a.defaultLocationId === b.defaultLocationId && a.defaultLocationType === b.defaultLocationType
    && normalizeWoolBatchNo(a.batchNo) === normalizeWoolBatchNo(b.batchNo)
}
export interface CentralWoolPublicBalance {
  key: string; row: CentralWoolStock; flow: WoolWarehouseFlow; quantity: number; expectedSource: string
}
export function centralWoolPublicBalances(facts: ReturnType<typeof centralWoolWarehouseFacts>): CentralWoolPublicBalance[] {
  const found = new Set<string>(), balances: CentralWoolPublicBalance[] = []
  for (const flow of facts.flows) {
    const defaultWarehouse = WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[flow.defaultLocationId]
    if (flow.flowType !== 'TRANSFER' || flow.physicalTransferDirection || flow.fromWarehouseId !== defaultWarehouse
      || flow.fromLocationId !== flow.defaultLocationId || !flow.toWarehouseId || !flow.toLocationId) continue
    const row = facts.stocks.find(r => r.order && !r.stock.physicalLocationId && r.stock.woolOrderId === flow.woolOrderId
      && r.stock.objectSkuCode === flow.objectSkuCode && r.stock.defaultLocationId === flow.defaultLocationId
      && normalizeWoolBatchNo(r.stock.batchNo) === normalizeWoolBatchNo(flow.batchNo))
    if (!row) continue
    const key = JSON.stringify([row.stock.stockKey, flow.toWarehouseId, flow.toLocationId])
    if (found.has(key)) continue
    found.add(key)
    const endpointFlows = facts.flows.filter(f => f.flowType === 'TRANSFER' && !f.physicalTransferDirection && sameObject(f, flow)
      && ((f.fromWarehouseId === defaultWarehouse && f.fromLocationId === flow.defaultLocationId
        && f.toWarehouseId === flow.toWarehouseId && f.toLocationId === flow.toLocationId)
        || (f.fromWarehouseId === flow.toWarehouseId && f.fromLocationId === flow.toLocationId
          && f.toWarehouseId === defaultWarehouse && f.toLocationId === flow.defaultLocationId)))
    const quantity = endpointFlows.reduce((n, f) => n + (f.fromLocationId === flow.defaultLocationId ? Math.abs(f.qty) : -Math.abs(f.qty)), 0)
    balances.push({ key, row, flow, quantity, expectedSource: JSON.stringify([row.order, endpointFlows]) })
  }
  return balances
}
interface RequestBase { actorId: string; stockKey: string; expectedSource: string; expectedTarget: string }
export type CentralWoolStockOperationRequest = RequestBase & (
  { kind: 'adjust'; input: AdjustWoolWarehouseStockInput }
  | { kind: 'transfer' | 'transferBack'; input: TransferWoolWarehouseStockInput; balanceKey?: string })
function quantity(value: number, unit: string, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) throw Error('WOP_quantity')
  if (unit !== 'kg' && !Number.isInteger(value)) throw Error('WOP_integer')
}
function owner(row: CentralWoolStock, actor: FactoryPdaUser) {
  assertCentralWoolActor(actor)
  if (!row.order || row.order.factoryId !== actor.factoryId) throw Error('WOOL_actor')
}
export function centralWoolStockOperationRequest(row: CentralWoolStock, kind: 'adjust' | 'transfer', value: number,
  reason: string, target: { warehouseId: string; locationId: string } | undefined, actor: FactoryPdaUser, commandId: string, at: string): CentralWoolStockOperationRequest {
  owner(row, actor); quantity(value, row.stock.unit, kind === 'adjust')
  if (!reason.trim()) throw Error('WOP_reason')
  const stock = row.stock, base = { actorId: actor.userId, stockKey: stock.stockKey, expectedSource: centralWoolStockSource(row), expectedTarget: '' }
  const input = { commandId, woolOrderId: stock.woolOrderId, objectSkuCode: stock.objectSkuCode,
    defaultLocationId: stock.defaultLocationId, batchNo: stock.batchNo, reason: reason.trim(), operatedAt: at, operatedBy: actor.name }
  if (kind === 'adjust') {
    if (stock.physicalLocationId) throw Error('WOP_physicalAdjustment')
    if (value === stock.currentQty) throw Error('WOP_sameQuantity')
    return { ...base, kind, input: { ...input, afterQty: value } }
  }
  if (value > stock.currentQty) throw Error('WST_limit')
  const position = target && resolveEnabledFactoryWarehouseLocation(target.warehouseId, target.locationId)
  if (!position) throw Error('WOP_target')
  if (stock.physicalLocationId && (position.warehouse.factoryId !== actor.factoryId || position.warehouse.warehouseKind !== 'WAIT_PROCESS'
    || (stock.physicalWarehouseId === target!.warehouseId && stock.physicalLocationId === target!.locationId))) throw Error('WOP_target')
  return { ...base, expectedTarget: JSON.stringify(position), kind, input: { ...input,
    physicalWarehouseId: stock.physicalWarehouseId, physicalLocationId: stock.physicalLocationId,
    fromWarehouseId: WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[stock.defaultLocationId], fromLocationId: stock.defaultLocationId,
    toWarehouseId: target!.warehouseId, toLocationId: target!.locationId, qty: value } }
}
export function centralWoolTransferBackRequest(balance: CentralWoolPublicBalance, value: number, reason: string,
  actor: FactoryPdaUser, commandId: string, at: string): CentralWoolStockOperationRequest {
  owner(balance.row, actor); quantity(value, balance.row.stock.unit)
  if (!reason.trim()) throw Error('WOP_reason')
  if (value > balance.quantity) throw Error('WST_limit')
  const source = resolveEnabledFactoryWarehouseLocation(balance.flow.toWarehouseId!, balance.flow.toLocationId!)
  if (!source) throw Error('WOP_target')
  const stock = balance.row.stock
  return { kind: 'transferBack', balanceKey: balance.key, actorId: actor.userId, stockKey: stock.stockKey,
    expectedSource: balance.expectedSource, expectedTarget: JSON.stringify(source), input: { commandId, woolOrderId: stock.woolOrderId,
      objectSkuCode: stock.objectSkuCode, defaultLocationId: stock.defaultLocationId, batchNo: stock.batchNo,
      fromWarehouseId: balance.flow.toWarehouseId, fromLocationId: balance.flow.toLocationId,
      toWarehouseId: WOOL_DEFAULT_WAREHOUSE_BY_LOCATION[stock.defaultLocationId], toLocationId: stock.defaultLocationId,
      qty: value, reason: reason.trim(), operatedAt: at, operatedBy: actor.name } }
}
export async function saveCentralWoolStockOperation(request: CentralWoolStockOperationRequest, actor: FactoryPdaUser) {
  await prepareCentralWool(); assertCentralWoolActor(actor)
  if (request.actorId !== actor.userId || request.input.operatedBy !== actor.name) throw Error('WOOL_actor')
  try { return await runWoolRecordCommand(() => {
    assertCentralWoolActor(actor)
    const facts = centralWoolWarehouseFacts(actor.factoryId), row = facts.stocks.find(r => r.stock.stockKey === request.stockKey)
    if (!row?.order || row.order.factoryId !== actor.factoryId || row.order.woolOrderId !== request.input.woolOrderId) throw Error('WOOL_actor')
    const retry = facts.store.operationLogs.some(log => { const r = log.afterValue as WoolCommandReceiptValue | undefined
      return r?.commandId === request.input.commandId && r.targetId === request.input.woolOrderId
        && r.commandType === (request.kind === 'adjust' ? 'ADJUST_WOOL_WAREHOUSE_STOCK' : 'TRANSFER_WOOL_WAREHOUSE_STOCK') })
    if (!retry) {
      const original = request.input
      let expected: CentralWoolStockOperationRequest
      if (request.kind === 'transferBack') {
        const balance = centralWoolPublicBalances(facts).find(b => b.key === request.balanceKey)
        if (!balance) throw Error('WOOL_changed')
        expected = centralWoolTransferBackRequest(balance, request.input.qty, original.reason, actor, original.commandId, original.operatedAt)
      } else expected = centralWoolStockOperationRequest(row, request.kind,
        request.kind === 'adjust' ? request.input.afterQty : request.input.qty, original.reason,
        request.kind === 'transfer' ? { warehouseId: request.input.toWarehouseId, locationId: request.input.toLocationId } : undefined,
        actor, original.commandId, original.operatedAt)
      if (expected.expectedSource !== request.expectedSource || expected.expectedTarget !== request.expectedTarget
        || JSON.stringify(expected.input) !== JSON.stringify(request.input)) throw Error('WOOL_changed')
    }
    return request.kind === 'adjust' ? adjustWoolWarehouseStock(request.input) : transferWoolWarehouseStock(request.input)
  }) } catch (error) {
    if (!(error as { committed?: boolean })?.committed && error instanceof Error
      && /记录已被其他页面修改|其他标签页已更新/.test(error.message)) throw Error('WOOL_changed', { cause: error })
    throw error
  }
}
