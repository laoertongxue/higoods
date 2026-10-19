import {
  dispatchAccessoryTransfer, receiveAccessoryTransfer,
  createAccessoryReassignmentTransfer,
  type AccessoryTransfer, type AccessoryLocation, type AccessoryReceiptLine, type AccessoryReassignment,
} from './accessory-warehouse-flow.ts'
import {
  dispatchAccessoryTransferStock, receiveAccessoryTransferStock, getAccessoryStockId,
  type AccessoryStock,
} from './accessory-warehouse-stock.ts'
import { accessoryRecord } from './accessory-warehouse-records.ts'
import type { CuttingRecordChange } from '../fcs/cutting/cutting-record-repository.ts'

export interface AccessoryReceipt {
  id: string
  transferId: string
  warehouseCode: string
  status: '待收货' | '已收货' | '已取消'
  version: number
  lines: AccessoryReceiptLine[]
  receivedAt?: string
  receivedBy?: string
  cancelledAt?: string
  cancellationReason?: string
  replacedByReceiptId?: string
}
export interface AccessoryWarehouseActor { warehouseCode: string; role: '仓管' | 'PPIC' | '领料方'; name: string }
export function accessoryReceiptForTransfer(transfer: AccessoryTransfer): AccessoryReceipt | undefined {
  if (!transfer.toWarehouse) return undefined
  return { id: `RECEIPT:${transfer.id}:${transfer.toWarehouse}:V${transfer.version}`, transferId: transfer.id, warehouseCode: transfer.toWarehouse, status: '待收货', version: 1, lines: [] }
}
function requireActor(actor: AccessoryWarehouseActor, warehouseCode: string): void {
  if (actor.role !== '仓管' || actor.warehouseCode !== warehouseCode || !actor.name.trim()) throw new Error('仅本仓仓管可确认本次实物交接。')
}
function stockVersions(stocks: AccessoryStock[]): Record<string, number> { return Object.fromEntries(stocks.map(stock => [stock.id, stock.version])) }
function availableByLine(stocks: AccessoryStock[], transfer: AccessoryTransfer): Record<string, number> {
  // 同一库存余额不会逐行重复放行；聚合防超量还会由库存计算独立校验。
  const remaining = new Map(stocks.map(stock => [JSON.stringify([stock.warehouseCode, stock.locationId, stock.materialSku, stock.unit]), stock]))
  const consumed = new Map<string, number>(), quantities: Record<string, number> = {}
  for (const line of transfer.lines) {
    const key = JSON.stringify([transfer.fromWarehouse, line.fromLocationId, line.materialSku, line.unit]), stock = remaining.get(key)
    const allowance = !stock ? 0 : transfer.kind === 'GTP_TO_SITE'
      ? stock.sourceRefs?.find(ref => ref.kind === 'RESERVATION' && ref.sourceId === transfer.preparationId)?.qty || 0
      : stock.onHandQty - stock.reservedQty
    const used = consumed.get(key) || 0
    quantities[line.id] = Math.max(0, allowance - used)
    consumed.set(key, used + line.qty)
  }
  return quantities
}
export function buildAccessoryDispatchChange(input: { transfer: AccessoryTransfer; stocks: AccessoryStock[]; actor: AccessoryWarehouseActor; commandId: string; at: string }): { transfer: AccessoryTransfer; change: CuttingRecordChange } {
  requireActor(input.actor, input.transfer.fromWarehouse)
  const transfer = dispatchAccessoryTransfer(input.transfer, { at: input.at, by: input.actor.name }, availableByLine(input.stocks, input.transfer))
  const stock = dispatchAccessoryTransferStock(input.stocks, input.transfer, { operationId: input.commandId, expectedVersions: stockVersions(input.stocks) })
  return { transfer, change: { puts: [accessoryRecord('transfer', transfer.id, transfer), ...stock.changed.map(row => accessoryRecord('stock', row.id, row)), accessoryRecord('audit', input.commandId, { id: input.commandId, transferId: transfer.id, action: '整单出库', warehouseCode: input.actor.warehouseCode, at: input.at, by: input.actor.name })] } }
}
export function buildAccessoryReceiveChange(input: {
  transfer: AccessoryTransfer; receipt: AccessoryReceipt; stocks: AccessoryStock[];
  lines: AccessoryReceiptLine[]; locations: AccessoryLocation[]; actor: AccessoryWarehouseActor; commandId: string; at: string;
  reassignments?: AccessoryReassignment[]
}): { transfer: AccessoryTransfer; receipt: AccessoryReceipt; change: CuttingRecordChange } {
  const warehouse = input.transfer.toWarehouse
  if (!warehouse || input.receipt.transferId !== input.transfer.id || input.receipt.warehouseCode !== warehouse || input.receipt.status !== '待收货') throw new Error('当前接收事项已失效或不属于本仓，请重新读取。')
  requireActor(input.actor, warehouse)
  const transfer = receiveAccessoryTransfer(input.transfer, { warehouseCode: warehouse, lines: input.lines, locations: input.locations, at: input.at, by: input.actor.name })
  const expectedVersions = stockVersions(input.stocks)
  for (const line of input.lines) {
    const source = input.transfer.lines.find(item => item.id === line.lineId)
    if (!source) throw new Error('接收物料范围已变化。')
    // 新库存身份由库存函数核对；缺失目标仅能由这次真实接收创建。
    const id = getAccessoryStockId(warehouse, line.locationId, source.materialSku, source.unit)
    expectedVersions[id] ??= 0
  }
  const stock = receiveAccessoryTransferStock(input.stocks, input.transfer, input.lines, { operationId: input.commandId, expectedVersions })
  const receipt: AccessoryReceipt = { ...input.receipt, version: input.receipt.version + 1, status: '已收货', lines: structuredClone(input.lines), receivedAt: input.at, receivedBy: input.actor.name }
  const waiting = (input.reassignments || []).filter(change => change.sourceTransferId === transfer.id && change.status === '等待原仓收货')
  if (waiting.length > 1) throw new Error('同一原仓待收有多个改厂安排，需核对后再收货。')
  const onward = waiting.map(change => createAccessoryReassignmentTransfer(transfer, change, { at: input.at, by: input.actor.name, transferId: `AW-REASSIGN:${change.id}` }))
  return { transfer, receipt, change: { puts: [accessoryRecord('transfer', transfer.id, transfer), accessoryRecord('receipt', receipt.id, receipt), ...stock.changed.map(row => accessoryRecord('stock', row.id, row)),
    ...waiting.map(change => accessoryRecord('change', change.id, { ...change, status: '待仓间调拨' })),
    ...onward.flatMap(row => [accessoryRecord('transfer', row.id, row), accessoryRecord('receipt', accessoryReceiptForTransfer(row)!.id, accessoryReceiptForTransfer(row)!)]),
    accessoryRecord('audit', input.commandId, { id: input.commandId, transferId: transfer.id, receiptId: receipt.id, action: '收货入库并上架', warehouseCode: warehouse, at: input.at, by: input.actor.name })] } }
}
