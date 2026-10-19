import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AccessoryStockError,
  dispatchAccessoryPickupStock,
  dispatchAccessoryTransferStock,
  getAccessoryStockAvailable,
  getAccessoryStockId,
  receiveAccessoryTransferStock,
  releaseAccessoryPreparationStock,
  reserveAccessoryPreparationStock,
  type AccessoryStock,
  type AccessoryStockAction,
} from '../../src/data/wls/accessory-warehouse-stock.ts'
import {
  ACCESSORY_GTP_WAREHOUSE as GTP,
  ACCESSORY_HILON_WAREHOUSE as HILON,
  ACCESSORY_MAHAMERU_WAREHOUSE as MAHAMERU,
  ACCESSORY_POST_WAREHOUSE as DLN,
  type AccessoryPreparation,
  type AccessoryTransfer,
  type AccessoryPickup,
} from '../../src/data/wls/accessory-warehouse-flow.ts'

const codes = (code: string) => (error: unknown) => error instanceof AccessoryStockError && error.code === code
function stock(overrides: Partial<AccessoryStock> = {}): AccessoryStock {
  const row = { warehouseCode: GTP, locationId: 'A01', materialSku: 'ZIP-01', unit: '条', onHandQty: 100, reservedQty: 0, version: 1, ...overrides }
  return { ...row, id: overrides.id ?? getAccessoryStockId(row.warehouseCode, row.locationId, row.materialSku, row.unit) }
}
function action(stocks: AccessoryStock[], operationId = 'OP-1'): AccessoryStockAction {
  return { operationId, expectedVersions: Object.fromEntries(stocks.map(row => [row.id, row.version])) }
}
function preparation(id = 'PREP-1'): AccessoryPreparation {
  const line = { materialSku: 'ZIP-01', materialName: '拉链', imageUrl: '/zip.jpg', color: '黑', spec: '20cm', unit: '条', requiredQty: 100, preparedQty: 0, availableQty: 100, locationId: 'A01', purpose: '其他' as const, requiresCutting: false }
  return { id, productionOrderId: 'PO-1', productionOrderNo: 'SC-1', styleName: '外套', styleImageUrl: '/style.jpg', techPackVersion: 'TP-v2', cuttingFactoryId: null, cuttingFactoryName: null, version: 1, status: '待配料', remark: '', lines: [{ ...line, id: 'LINE-1' }, { ...line, id: 'LINE-2' }], history: [] }
}
function transfer(overrides: Partial<AccessoryTransfer> = {}): AccessoryTransfer {
  const line = { materialSku: 'ZIP-01', materialName: '拉链', imageUrl: '/zip.jpg', color: '黑', spec: '20cm', unit: '条', purpose: '其他' as const, requiresCutting: false, fromLocationId: 'A01' }
  return {
    id: 'TRANSFER-1', preparationId: 'PREP-1', productionOrderId: 'PO-1', kind: 'GTP_TO_SITE', fromWarehouse: GTP, toWarehouse: HILON,
    status: '待出库', version: 1, createdAt: '2026-10-19 09:00:00', createdBy: '仓管', history: [],
    lines: [{ ...line, id: 'LINE-1', qty: 40 }, { ...line, id: 'LINE-2', qty: 50 }], ...overrides,
  }
}
function withChanges(stocks: AccessoryStock[], changed: AccessoryStock[]): AccessoryStock[] {
  const next = new Map(stocks.map(row => [row.id, row]))
  for (const row of changed) next.set(row.id, row)
  return [...next.values()]
}
function reservedStocks() {
  const stocks = [stock()]
  return reserveAccessoryPreparationStock(stocks, preparation(), [{ lineId: 'LINE-1', locationId: 'A01', qty: 40 }, { lineId: 'LINE-2', locationId: 'A01', qty: 50 }], action(stocks, 'RESERVE-1')).changed
}

test('库存身份不含生产单；位置、SKU、单位分别决定身份且编码无碰撞', () => {
  const id = getAccessoryStockId(GTP, 'A:01', 'SKU/1', '条')
  assert.equal(id, getAccessoryStockId(GTP, 'A:01', 'SKU/1', '条'))
  assert.notEqual(id, getAccessoryStockId(GTP, 'A', '01:SKU/1', '条'))
  assert.notEqual(id, getAccessoryStockId(GTP, 'A:01', 'SKU/1', '米'))
  assert.notEqual(id, getAccessoryStockId(HILON, 'A:01', 'SKU/1', '条'))
  assert.throws(() => getAccessoryStockId(GTP, '', 'SKU', '条'), codes('MISSING_STOCK_SOURCE'))
})

test('配料只预留不扣实物，同SKU同位置多行先聚合而非重复放行', () => {
  const stocks = [stock()], before = structuredClone(stocks)
  assert.throws(() => reserveAccessoryPreparationStock(stocks, preparation(), [{ lineId: 'LINE-1', qty: 60, locationId: 'A01' }, { lineId: 'LINE-2', qty: 60, locationId: 'A01' }], action(stocks)), codes('INSUFFICIENT_AVAILABLE_STOCK'))
  assert.deepEqual(stocks, before)
  const result = reserveAccessoryPreparationStock(stocks, preparation(), [{ lineId: 'LINE-1', qty: 40, locationId: 'A01' }, { lineId: 'LINE-2', qty: 50, locationId: 'A01' }], action(stocks))
  assert.equal(result.changed.length, 1)
  assert.equal(result.changed[0].onHandQty, 100)
  assert.equal(result.changed[0].reservedQty, 90)
  assert.equal(result.changed[0].version, 2)
  assert.equal(getAccessoryStockAvailable(result.changed[0]), 10)
  assert.deepEqual(result.changed[0].sourceRefs?.find(ref => ref.kind === 'RESERVATION'), { kind: 'RESERVATION', sourceId: 'PREP-1', qty: 90 })
})

test('不同生产单共享同SKU可用库存，不能在每个生产单再虚构完整余额', () => {
  const stocks = reservedStocks()
  assert.throws(() => reserveAccessoryPreparationStock(stocks, preparation('PREP-2'), [{ lineId: 'LINE-1', qty: 11, locationId: 'A01' }], action(stocks, 'RESERVE-2')), codes('INSUFFICIENT_AVAILABLE_STOCK'))
  const result = reserveAccessoryPreparationStock(stocks, preparation('PREP-2'), [{ lineId: 'LINE-1', qty: 10, locationId: 'A01' }], action(stocks, 'RESERVE-2'))
  assert.equal(result.changed[0].reservedQty, 100)
  assert.equal(result.changed[0].onHandQty, 100)
  assert.deepEqual(result.changed[0].sourceRefs?.filter(ref => ref.kind === 'RESERVATION').map(ref => [ref.sourceId, ref.qty]), [['PREP-1', 90], ['PREP-2', 10]])
})

test('缺来源库存不落种子；任何行失败原数组保持完整', () => {
  const stocks = [stock()], before = structuredClone(stocks)
  assert.throws(() => reserveAccessoryPreparationStock(stocks, preparation(), [{ lineId: 'LINE-1', qty: 10, locationId: 'A01' }, { lineId: 'LINE-2', qty: 10, locationId: 'MISSING' }], action(stocks)), codes('STOCK_NOT_FOUND'))
  assert.deepEqual(stocks, before)
  assert.throws(() => reserveAccessoryPreparationStock([], preparation(), [{ lineId: 'LINE-1', qty: 10, locationId: 'A01' }], { operationId: 'NEW', expectedVersions: {} }), codes('STOCK_NOT_FOUND'))
})

test('同命令相同内容重放不重复预留，不同数量或半套操作拒绝', () => {
  const original = [stock()]
  const entries = [{ lineId: 'LINE-1', qty: 40, locationId: 'A01' }, { lineId: 'LINE-2', qty: 50, locationId: 'A01' }]
  const first = reserveAccessoryPreparationStock(original, preparation(), entries, action(original))
  assert.deepEqual(reserveAccessoryPreparationStock(first.changed, preparation(), entries, action(original)), { changed: [], replayed: true })
  assert.throws(() => reserveAccessoryPreparationStock(first.changed, preparation(), [{ lineId: 'LINE-1', qty: 10, locationId: 'A01' }], action(original)), codes('STOCK_OPERATION_CONFLICT'))
  const added = [...first.changed, stock({ locationId: 'B01' })]
  assert.throws(() => reserveAccessoryPreparationStock(added, preparation(), [{ lineId: 'LINE-1', qty: 90, locationId: 'A01' }, { lineId: 'LINE-2', qty: 5, locationId: 'B01' }], action(added)), codes('STOCK_OPERATION_CONFLICT'))
})

test('版本遗漏或竞争拒绝；重复库存、非法余额和归属不一致不能作为可用来源', () => {
  const stocks = [stock()], entries = [{ lineId: 'LINE-1', qty: 1, locationId: 'A01' }]
  assert.throws(() => reserveAccessoryPreparationStock(stocks, preparation(), entries, { operationId: 'NEW', expectedVersions: {} }), codes('STOCK_VERSION_CONFLICT'))
  assert.throws(() => reserveAccessoryPreparationStock(stocks, preparation(), entries, { operationId: 'NEW', expectedVersions: { [stocks[0].id]: 0 } }), codes('STOCK_VERSION_CONFLICT'))
  assert.throws(() => reserveAccessoryPreparationStock([...stocks, stocks[0]], preparation(), entries, action(stocks)), codes('DUPLICATE_STOCK_RECORD'))
  assert.throws(() => getAccessoryStockAvailable(stock({ reservedQty: 101 })), codes('STOCK_BALANCE_CONFLICT'))
  assert.throws(() => getAccessoryStockAvailable(stock({ reservedQty: 1, sourceRefs: [{ kind: 'RESERVATION', sourceId: 'P', qty: 2 }] })), codes('RESERVATION_BALANCE_CONFLICT'))
})

test('释放仅减少本单预留，不减少实物；不能释放其他生产单或不明旧预留', () => {
  const stocks = reservedStocks()
  const rows = [{ warehouseCode: GTP, locationId: 'A01', materialSku: 'ZIP-01', unit: '条', qty: 20 }]
  const result = releaseAccessoryPreparationStock(stocks, 'PREP-1', rows, action(stocks, 'RELEASE-1'))
  assert.equal(result.changed[0].onHandQty, 100)
  assert.equal(result.changed[0].reservedQty, 70)
  assert.equal(result.changed[0].sourceRefs?.find(ref => ref.kind === 'RESERVATION')?.qty, 70)
  assert.throws(() => releaseAccessoryPreparationStock(stocks, 'PREP-OTHER', rows, action(stocks, 'RELEASE-2')), codes('RESERVATION_SOURCE_MISSING'))
  assert.throws(() => releaseAccessoryPreparationStock([stock({ reservedQty: 80 })], 'PREP-1', rows, action([stock({ reservedQty: 80 })], 'RELEASE-3')), codes('RESERVATION_SOURCE_MISSING'))
  assert.deepEqual(releaseAccessoryPreparationStock(result.changed, 'PREP-1', rows, action(stocks, 'RELEASE-1')), { changed: [], replayed: true })
})

test('GTP整单出库按聚合消耗本单预留，其他生产单预留与实物同时守恒', () => {
  const first = reservedStocks()
  const second = reserveAccessoryPreparationStock(first, preparation('PREP-2'), [{ lineId: 'LINE-1', qty: 10, locationId: 'A01' }], action(first, 'RESERVE-2')).changed
  const result = dispatchAccessoryTransferStock(second, transfer(), action(second, 'OUT-1'))
  assert.equal(result.changed.length, 1)
  assert.equal(result.changed[0].onHandQty, 10)
  assert.equal(result.changed[0].reservedQty, 10)
  assert.deepEqual(result.changed[0].sourceRefs?.filter(ref => ref.kind === 'RESERVATION'), [{ kind: 'RESERVATION', sourceId: 'PREP-2', qty: 10 }])
  assert.equal(second[0].onHandQty, 100)
  assert.deepEqual(dispatchAccessoryTransferStock(result.changed, transfer(), action(second, 'OUT-1')), { changed: [], replayed: true })
})

test('GTP不能借用另一生产单预留出库；同位置多行合计超过本单预留整单拒绝', () => {
  const stocks = reservedStocks(), before = structuredClone(stocks)
  assert.throws(() => dispatchAccessoryTransferStock(stocks, transfer({ preparationId: 'OTHER-PREP' }), action(stocks, 'OUT-OTHER')), codes('RESERVATION_SOURCE_MISSING'))
  const tooMuch = transfer()
  tooMuch.lines[1].qty = 51
  assert.throws(() => dispatchAccessoryTransferStock(stocks, tooMuch, action(stocks, 'OUT-TOO-MUCH')), codes('RESERVATION_SOURCE_MISSING'))
  assert.deepEqual(stocks, before)
  assert.throws(() => dispatchAccessoryTransferStock(stocks, { ...transfer(), status: '已出库待收货' }, action(stocks, 'OUT-TWICE')), codes('TRANSFER_NOT_DISPATCHABLE'))
})

test('现场后道和改仓只消耗可用实物，不能吞掉其他用途预留', () => {
  const stocks = [stock({ warehouseCode: HILON, reservedQty: 20 })]
  const source = transfer({ kind: 'SITE_TO_POST', fromWarehouse: HILON, toWarehouse: DLN })
  assert.throws(() => dispatchAccessoryTransferStock(stocks, source, action(stocks, 'POST-OUT')), codes('INSUFFICIENT_AVAILABLE_STOCK'))
  const smaller = { ...source, lines: source.lines.slice(0, 1) }
  const next = dispatchAccessoryTransferStock(stocks, smaller, action(stocks, 'POST-OUT'))
  assert.equal(next.changed[0].onHandQty, 60)
  assert.equal(next.changed[0].reservedQty, 20)
  const change = transfer({ kind: 'SITE_REASSIGN', fromWarehouse: HILON, toWarehouse: MAHAMERU, lines: source.lines.slice(0, 1) })
  assert.equal(dispatchAccessoryTransferStock(next.changed, change, action(next.changed, 'CHANGE-OUT')).changed[0].onHandQty, 20)
})

test('整单接收按目标位置聚合，真实接收才增加库存或建立新位置', () => {
  const sent = transfer({ status: '已出库待收货' })
  const receipts = sent.lines.map(row => ({ lineId: row.id, qty: row.qty, locationId: 'H-A01' }))
  const id = getAccessoryStockId(HILON, 'H-A01', 'ZIP-01', '条')
  const result = receiveAccessoryTransferStock([], sent, receipts, { operationId: 'IN-1', expectedVersions: { [id]: 0 } })
  assert.equal(result.changed.length, 1)
  assert.equal(result.changed[0].id, id)
  assert.equal(result.changed[0].onHandQty, 90)
  assert.equal(result.changed[0].reservedQty, 0)
  assert.equal(result.changed[0].version, 1)
  assert.deepEqual(receiveAccessoryTransferStock(result.changed, sent, receipts, { operationId: 'IN-1', expectedVersions: { [id]: 0 } }), { changed: [], replayed: true })
  const existing = stock({ warehouseCode: HILON, locationId: 'H-A01', onHandQty: 10, version: 4 })
  const added = receiveAccessoryTransferStock([existing], sent, receipts, action([existing], 'IN-2'))
  assert.equal(added.changed[0].onHandQty, 100)
  assert.equal(added.changed[0].version, 5)
})

test('分批、差异、空位置、错版本接收无半套库存', () => {
  const sent = transfer({ status: '已出库待收货' })
  const entries = sent.lines.map(row => ({ lineId: row.id, qty: row.qty, locationId: 'H-A01' }))
  const id = getAccessoryStockId(HILON, 'H-A01', 'ZIP-01', '条')
  const options = { operationId: 'IN-1', expectedVersions: { [id]: 0 } }
  assert.throws(() => receiveAccessoryTransferStock([], sent, entries.slice(0, 1), options), codes('PARTIAL_STOCK_RECEIPT'))
  assert.throws(() => receiveAccessoryTransferStock([], sent, entries.map((row, i) => i ? row : { ...row, qty: row.qty - 1 }), options), codes('STOCK_RECEIPT_DIFFERENCE'))
  assert.throws(() => receiveAccessoryTransferStock([], sent, entries.map(row => ({ ...row, locationId: '' })), options), codes('MISSING_STOCK_SOURCE'))
  assert.throws(() => receiveAccessoryTransferStock([], sent, entries, { ...options, expectedVersions: { [id]: 1 } }), codes('STOCK_VERSION_CONFLICT'))
  assert.throws(() => receiveAccessoryTransferStock([], transfer(), entries, options), codes('TRANSFER_NOT_RECEIVABLE'))
})

test('一次GTP出库到现场收货按同单位守恒，在途阶段目标没有增加', () => {
  const original = reservedStocks(), sent = transfer()
  const outbound = dispatchAccessoryTransferStock(original, sent, action(original, 'OUT-1'))
  assert.equal(outbound.changed[0].onHandQty, 10)
  assert.equal(outbound.changed.some(row => row.warehouseCode === HILON), false)
  const inTransit = { ...sent, status: '已出库待收货' as const }
  const entries = inTransit.lines.map(row => ({ lineId: row.id, qty: row.qty, locationId: 'H-A01' }))
  const targetId = getAccessoryStockId(HILON, 'H-A01', 'ZIP-01', '条')
  const received = receiveAccessoryTransferStock(outbound.changed, inTransit, entries, { operationId: 'IN-1', expectedVersions: { [targetId]: 0 } })
  const final = withChanges(outbound.changed, received.changed)
  assert.equal(final.reduce((sum, row) => sum + row.onHandQty, 0), original[0].onHandQty)
  assert.equal(final.find(row => row.warehouseCode === HILON)?.onHandQty, 90)
})

test('分次车缝实交逐次扣实物，同SKU多行先合并且不超剩余和可用', () => {
  const source = transfer({ kind: 'SITE_TO_POST', fromWarehouse: HILON, toWarehouse: DLN })
  const pickup: AccessoryPickup = {
    id: 'PICKUP-1', preparationId: 'PREP-1', productionOrderId: 'PO-1', sourceTransferId: 'TRANSFER-1', warehouseCode: HILON,
    taskId: 'TASK-1', assignmentId: 'ASSIGN-1', taskVersion: 'v2', factoryId: 'F-1', factoryName: '三方', version: 1, status: '待领料', history: [],
    lines: source.lines.map(row => ({ ...row, requiredQty: 60, handedQty: 0 })),
  }
  const stocks = [stock({ warehouseCode: HILON })]
  assert.throws(() => dispatchAccessoryPickupStock(stocks, pickup, [{ lineId: 'LINE-1', qty: 60 }, { lineId: 'LINE-2', qty: 60 }], action(stocks)), codes('INSUFFICIENT_AVAILABLE_STOCK'))
  assert.equal(stocks[0].onHandQty, 100)
  const first = dispatchAccessoryPickupStock(stocks, pickup, [{ lineId: 'LINE-1', qty: 20 }, { lineId: 'LINE-2', qty: 30 }], action(stocks, 'PICKUP-OP-1'))
  assert.equal(first.changed[0].onHandQty, 50)
  const updated = { ...pickup, status: '领料中' as const, lines: pickup.lines.map((row, i) => ({ ...row, handedQty: i ? 30 : 20 })) }
  const next = dispatchAccessoryPickupStock(first.changed, updated, [{ lineId: 'LINE-1', qty: 30 }], action(first.changed, 'PICKUP-OP-2'))
  assert.equal(next.changed[0].onHandQty, 20)
  assert.throws(() => dispatchAccessoryPickupStock(next.changed, updated, [{ lineId: 'LINE-1', qty: 41 }], action(next.changed, 'PICKUP-OP-3')), codes('OVER_PICKUP_QUANTITY'))
})

test('多库位片段只占用各自真实库存，空来源及无效数量拒绝', () => {
  const stocks = [stock(), stock({ locationId: 'B01', onHandQty: 20 })]
  const entries = [{ lineId: 'LINE-1', qty: 40, locationId: 'A01' }, { lineId: 'LINE-2', qty: 20, locationId: 'B01' }]
  const next = reserveAccessoryPreparationStock(stocks, preparation(), entries, action(stocks))
  assert.deepEqual(next.changed.map(row => [row.locationId, row.onHandQty, row.reservedQty]), [['A01', 100, 40], ['B01', 20, 20]])
  assert.throws(() => reserveAccessoryPreparationStock(stocks, preparation(), [{ lineId: 'LINE-1', qty: 1, locationId: '' }], action(stocks)), codes('MISSING_STOCK_SOURCE'))
  for (const qty of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) assert.throws(() => reserveAccessoryPreparationStock(stocks, preparation(), [{ lineId: 'LINE-1', qty, locationId: 'A01' }], action(stocks)), codes('INVALID_STOCK_QUANTITY'))
})
