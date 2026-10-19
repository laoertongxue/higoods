import {
  ACCESSORY_GTP_WAREHOUSE,
  type AccessoryPreparation,
  type AccessoryTransfer,
  type AccessoryReceiptLine,
  type AccessoryPickup,
} from './accessory-warehouse-flow.ts'

export type AccessoryStockOperationKind = 'RESERVE' | 'RELEASE' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'PICKUP_OUT'
export type AccessoryStockSourceRef =
  | { kind: 'RESERVATION'; sourceId: string; qty: number }
  | { kind: AccessoryStockOperationKind; sourceId: string; qty: number; operationId: string; reservationId?: string }
export interface AccessoryStock {
  id: string
  warehouseCode: string
  locationId: string
  materialSku: string
  unit: string
  onHandQty: number
  reservedQty: number
  version: number
  sourceRefs?: AccessoryStockSourceRef[]
}
export interface AccessoryStockQuantity {
  warehouseCode: string
  locationId: string
  materialSku: string
  unit: string
  qty: number
}
export interface AccessoryStockAction {
  operationId: string
  /** 每个受影响库存的预期版本；实际收货首次创建的库存为 0。 */
  expectedVersions: Readonly<Record<string, number>>
}
export interface AccessoryStockChange { changed: AccessoryStock[]; replayed: boolean }
export class AccessoryStockError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'AccessoryStockError'
    this.code = code
  }
}

const EPSILON = 0.000001
const roundQty = (qty: number) => Math.round(qty * 1_000_000) / 1_000_000
const equalQty = (left: number, right: number) => Math.abs(left - right) <= EPSILON
function requireValue(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new AccessoryStockError(code, message)
}
function requireQty(qty: number, allowZero = false): void {
  requireValue(Number.isFinite(qty) && (allowZero ? qty >= 0 : qty > 0), 'INVALID_STOCK_QUANTITY', '库存数量必须是有效的非负数量，办理数量必须大于零')
}
function requireText(value: string, label: string): void {
  requireValue(typeof value === 'string' && value.trim(), 'MISSING_STOCK_SOURCE', `${label}缺失，不能推测库存来源`)
}

/** 生产单不参与库存身份；多个生产单必须共同校验同一实物余额。 */
export function getAccessoryStockId(warehouseCode: string, locationId: string, materialSku: string, unit: string): string {
  requireText(warehouseCode, '仓库')
  requireText(locationId, '库位')
  requireText(materialSku, '物料 SKU')
  requireText(unit, '数量单位')
  return `ACCESSORY-STOCK:${[warehouseCode, locationId, materialSku, unit].map(value => encodeURIComponent(value)).join(':')}`
}

export function getAccessoryStockAvailable(stock: AccessoryStock): number {
  validateStock(stock)
  return roundQty(stock.onHandQty - stock.reservedQty)
}

function validateStock(stock: AccessoryStock): void {
  requireValue(stock.id === getAccessoryStockId(stock.warehouseCode, stock.locationId, stock.materialSku, stock.unit), 'STOCK_IDENTITY_CONFLICT', '库存身份与仓库、库位、SKU、单位不一致')
  requireQty(stock.onHandQty, true)
  requireQty(stock.reservedQty, true)
  requireValue(stock.reservedQty <= stock.onHandQty + EPSILON, 'STOCK_BALANCE_CONFLICT', '预留数量超过仓内实物数量，需核对原记录')
  requireValue(Number.isInteger(stock.version) && stock.version >= 0, 'INVALID_STOCK_VERSION', '库存版本无效，请重新读取')
  const reservations = new Set<string>()
  let ownedReserved = 0
  for (const ref of stock.sourceRefs || []) {
    requireText(ref.sourceId, '库存关联来源')
    requireQty(ref.qty)
    if (ref.kind === 'RESERVATION') {
      requireValue(!reservations.has(ref.sourceId), 'DUPLICATE_RESERVATION', '同一生产配料的预留归属重复')
      reservations.add(ref.sourceId)
      ownedReserved += ref.qty
    } else requireText(ref.operationId, '库存操作身份')
  }
  // 允许已存在但尚未迁移归属的预留继续占用，不允许把它当成本单预留消耗。
  requireValue(ownedReserved <= stock.reservedQty + EPSILON, 'RESERVATION_BALANCE_CONFLICT', '预留归属合计超过库存预留数量')
}

function aggregate(rows: readonly AccessoryStockQuantity[]): Map<string, AccessoryStockQuantity> {
  requireValue(rows.length, 'EMPTY_STOCK_ACTION', '本次操作没有库存明细')
  const grouped = new Map<string, AccessoryStockQuantity>()
  for (const row of rows) {
    requireQty(row.qty)
    const id = getAccessoryStockId(row.warehouseCode, row.locationId, row.materialSku, row.unit)
    const previous = grouped.get(id)
    grouped.set(id, { ...row, qty: roundQty((previous?.qty || 0) + row.qty) })
  }
  return grouped
}

function currentStockMap(stocks: readonly AccessoryStock[]): Map<string, AccessoryStock> {
  const records = new Map<string, AccessoryStock>()
  for (const stock of stocks) {
    validateStock(stock)
    requireValue(!records.has(stock.id), 'DUPLICATE_STOCK_RECORD', '同一仓库、库位、SKU、单位存在重复库存记录')
    records.set(stock.id, stock)
  }
  return records
}

function reservationOf(stock: AccessoryStock, preparationId: string): number {
  return stock.sourceRefs?.find(ref => ref.kind === 'RESERVATION' && ref.sourceId === preparationId)?.qty || 0
}

function updateReservation(stock: AccessoryStock, preparationId: string, delta: number): void {
  const nextQty = roundQty(reservationOf(stock, preparationId) + delta)
  requireValue(nextQty >= 0, 'RESERVATION_SOURCE_MISSING', '本单预留不足，不能释放或借用其他生产单预留')
  const refs = (stock.sourceRefs || []).filter(ref => !(ref.kind === 'RESERVATION' && ref.sourceId === preparationId))
  if (nextQty > 0) refs.push({ kind: 'RESERVATION', sourceId: preparationId, qty: nextQty })
  stock.sourceRefs = refs
}

/** 调用方传入完整的本任务库存记录；不读取、不创建演示库存或自动初始化。 */
function calculateStockAction(stocks: readonly AccessoryStock[], rows: readonly AccessoryStockQuantity[], action: AccessoryStockAction, input: {
  kind: AccessoryStockOperationKind; sourceId: string; reservationId?: string; allowNewReceipt?: boolean
}): AccessoryStockChange {
  requireText(action.operationId, '库存操作身份')
  requireText(input.sourceId, '业务来源')
  const grouped = aggregate(rows)
  const records = currentStockMap(stocks)
  const previousOperations: Array<{ stockId: string; ref: Exclude<AccessoryStockSourceRef, { kind: 'RESERVATION' }> }> = []
  for (const stock of stocks) for (const ref of stock.sourceRefs || []) {
    if (ref.kind !== 'RESERVATION' && ref.operationId === action.operationId) previousOperations.push({ stockId: stock.id, ref })
  }
  if (previousOperations.length) {
    requireValue(previousOperations.length === grouped.size && new Set(previousOperations.map(row => row.stockId)).size === grouped.size
      && previousOperations.every(({ stockId, ref }) => {
        const row = grouped.get(stockId)
        return row && ref.kind === input.kind && ref.sourceId === input.sourceId && ref.reservationId === input.reservationId && equalQty(row.qty, ref.qty)
      }), 'STOCK_OPERATION_CONFLICT', '同一库存操作已保存了不同内容，或原操作明细不完整，请重新读取')
    return { changed: [], replayed: true }
  }
  const changed: AccessoryStock[] = []
  // 先完整计算，任一行失败不会修改调用方的原数组及记录。
  for (const [id, row] of grouped) {
    let stock = records.get(id)
    requireValue(stock || input.allowNewReceipt, 'STOCK_NOT_FOUND', `${row.materialSku}在来源库位没有库存记录，未使用需求量虚构库存`)
    const expected = action.expectedVersions[id]
    requireValue(Number.isInteger(expected) && expected >= 0 && expected === (stock?.version ?? 0), 'STOCK_VERSION_CONFLICT', '库存版本已变化或未提供预期版本，请重新读取后核对')
    stock = stock ? structuredClone(stock) : { id, warehouseCode: row.warehouseCode, locationId: row.locationId, materialSku: row.materialSku, unit: row.unit, onHandQty: 0, reservedQty: 0, version: 0, sourceRefs: [] }
    if (input.kind === 'RESERVE') {
      requireValue(getAccessoryStockAvailable(stock) + EPSILON >= row.qty, 'INSUFFICIENT_AVAILABLE_STOCK', `${row.materialSku}可用库存不足，配料未预留`)
      updateReservation(stock, input.sourceId, row.qty)
      stock.reservedQty = roundQty(stock.reservedQty + row.qty)
    } else if (input.kind === 'RELEASE') {
      requireValue(reservationOf(stock, input.sourceId) + EPSILON >= row.qty, 'RESERVATION_SOURCE_MISSING', `${row.materialSku}本单预留不足，不能释放其他来源的预留`)
      updateReservation(stock, input.sourceId, -row.qty)
      stock.reservedQty = roundQty(stock.reservedQty - row.qty)
    } else if (input.kind === 'TRANSFER_IN') {
      stock.onHandQty = roundQty(stock.onHandQty + row.qty)
    } else {
      if (input.reservationId) {
        requireValue(reservationOf(stock, input.reservationId) + EPSILON >= row.qty, 'RESERVATION_SOURCE_MISSING', `${row.materialSku}缺少本配料单预留，不能借用其他生产单数量出库`)
        updateReservation(stock, input.reservationId, -row.qty)
        stock.reservedQty = roundQty(stock.reservedQty - row.qty)
      } else requireValue(getAccessoryStockAvailable(stock) + EPSILON >= row.qty, 'INSUFFICIENT_AVAILABLE_STOCK', `${row.materialSku}可用库存不足，整笔未交出`)
      requireValue(stock.onHandQty + EPSILON >= row.qty, 'INSUFFICIENT_PHYSICAL_STOCK', `${row.materialSku}实物库存不足，整笔未出库`)
      stock.onHandQty = roundQty(stock.onHandQty - row.qty)
    }
    stock.version += 1
    stock.sourceRefs = [...(stock.sourceRefs || []), { kind: input.kind, sourceId: input.sourceId, operationId: action.operationId, reservationId: input.reservationId, qty: row.qty }]
    validateStock(stock)
    changed.push(stock)
  }
  return { changed, replayed: false }
}

export function reserveAccessoryPreparationStock(stocks: readonly AccessoryStock[], preparation: AccessoryPreparation,
  entries: readonly { lineId: string; qty: number; locationId: string }[], action: AccessoryStockAction): AccessoryStockChange {
  requireValue(preparation.status !== '已配齐', 'PREPARATION_ALREADY_COMPLETED', '已配齐记录不能继续预留')
  const rows = entries.map(entry => {
    const line = preparation.lines.find(item => item.id === entry.lineId)
    requireValue(line && !line.requiresCutting, 'UNKNOWN_PREPARATION_LINE', '配料来源明细缺失或需要裁剪')
    return { warehouseCode: ACCESSORY_GTP_WAREHOUSE, locationId: entry.locationId, materialSku: line.materialSku, unit: line.unit, qty: entry.qty }
  })
  return calculateStockAction(stocks, rows, action, { kind: 'RESERVE', sourceId: preparation.id })
}

export function releaseAccessoryPreparationStock(stocks: readonly AccessoryStock[], preparationId: string,
  entries: readonly AccessoryStockQuantity[], action: AccessoryStockAction): AccessoryStockChange {
  requireValue(entries.every(row => row.warehouseCode === ACCESSORY_GTP_WAREHOUSE), 'INVALID_RESERVATION_WAREHOUSE', '本次只释放辅料中央仓的配料预留')
  return calculateStockAction(stocks, entries, action, { kind: 'RELEASE', sourceId: preparationId })
}

export function dispatchAccessoryTransferStock(stocks: readonly AccessoryStock[], transfer: AccessoryTransfer, action: AccessoryStockAction): AccessoryStockChange {
  requireValue(transfer.status === '待出库', 'TRANSFER_NOT_DISPATCHABLE', '库存出库须对应当前待出库调拨，不能重复扣减')
  requireValue(transfer.toWarehouse && transfer.toWarehouse !== transfer.fromWarehouse, 'MISSING_STOCK_SOURCE', '调拨目的方尚未确定')
  requireValue(transfer.kind !== 'GTP_TO_SITE' || transfer.fromWarehouse === ACCESSORY_GTP_WAREHOUSE, 'INVALID_RESERVATION_WAREHOUSE', '首次调拨来源必须为辅料中央仓')
  return calculateStockAction(stocks, transfer.lines.map(line => ({
    warehouseCode: transfer.fromWarehouse, locationId: line.fromLocationId, materialSku: line.materialSku, unit: line.unit, qty: line.qty,
  })), action, { kind: 'TRANSFER_OUT', sourceId: transfer.id, reservationId: transfer.kind === 'GTP_TO_SITE' ? transfer.preparationId : undefined })
}

export function receiveAccessoryTransferStock(stocks: readonly AccessoryStock[], transfer: AccessoryTransfer,
  entries: readonly AccessoryReceiptLine[], action: AccessoryStockAction): AccessoryStockChange {
  requireValue(transfer.status === '已出库待收货' && transfer.toWarehouse, 'TRANSFER_NOT_RECEIVABLE', '库存入库须对应已经实际出库的当前调拨')
  requireValue(entries.length === transfer.lines.length && new Set(entries.map(entry => entry.lineId)).size === transfer.lines.length, 'PARTIAL_STOCK_RECEIPT', '调拨收货必须核对全部明细，不能分批入库')
  const rows = transfer.lines.map(line => {
    const received = entries.find(entry => entry.lineId === line.id)
    requireValue(received && equalQty(received.qty, line.qty), 'STOCK_RECEIPT_DIFFERENCE', '实收与应收不一致，整单库存未入库')
    return { warehouseCode: transfer.toWarehouse!, locationId: received.locationId, materialSku: line.materialSku, unit: line.unit, qty: received.qty }
  })
  // 新目标位置只因真实接收而建立记录，不把配料需求当作已有库存。
  return calculateStockAction(stocks, rows, action, { kind: 'TRANSFER_IN', sourceId: transfer.id, allowNewReceipt: true })
}

export function dispatchAccessoryPickupStock(stocks: readonly AccessoryStock[], pickup: AccessoryPickup,
  entries: readonly { lineId: string; qty: number }[], action: AccessoryStockAction): AccessoryStockChange {
  requireValue(pickup.status !== '已领料', 'PICKUP_ALREADY_COMPLETED', '当前领料清单已经全部实交')
  requireValue(pickup.status !== '已失效', 'STALE_PICKUP', '原领料清单已失效，不能扣减库存')
  requireValue(new Set(entries.map(entry => entry.lineId)).size === entries.length, 'DUPLICATE_PICKUP_LINE', '本次领料明细重复')
  const rows = entries.map(entry => {
    const line = pickup.lines.find(item => item.id === entry.lineId)
    requireValue(line, 'UNKNOWN_PICKUP_LINE', '领料来源明细已经变化')
    requireValue(entry.qty <= line.requiredQty - line.handedQty + EPSILON, 'OVER_PICKUP_QUANTITY', '本次实交超过当前剩余应领数量')
    return { warehouseCode: pickup.warehouseCode, locationId: line.fromLocationId, materialSku: line.materialSku, unit: line.unit, qty: entry.qty }
  })
  return calculateStockAction(stocks, rows, action, { kind: 'PICKUP_OUT', sourceId: pickup.id })
}
