import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCESSORY_GTP_WAREHOUSE as GTP,
  ACCESSORY_HILON_WAREHOUSE as HILON,
  ACCESSORY_MAHAMERU_WAREHOUSE as MAHAMERU,
  ACCESSORY_POST_WAREHOUSE as DLN,
  AccessoryFlowError,
  completeAccessoryPreparation,
  createAccessoryPickup,
  createAccessoryPostTransfer,
  createAccessoryReassignmentTransfer,
  dispatchAccessoryTransfer,
  getAccessoryPreparationRemaining,
  getAccessoryLineAllocations,
  getAccessoryWarehouseForCuttingFactory,
  planAccessoryCuttingFactoryChange,
  receiveAccessoryTransfer,
  recordAccessoryPickup,
  registerAccessoryPreparation,
  setAccessoryTransferDestination,
  splitAccessoryLinesForTask,
  type AccessoryLine,
  type AccessoryPreparation,
  type AccessoryTransfer,
} from '../../src/data/wls/accessory-warehouse-flow.ts'

const ACTION = { at: '2026-10-19 09:00:00', by: '辅料仓管' }
const POST_ACTION = { at: '2026-10-19 10:00:00', by: 'DLN仓管' }
const codes = (code: string) => (error: unknown) => error instanceof AccessoryFlowError && error.code === code

function line(overrides: Partial<AccessoryLine> = {}): AccessoryLine {
  return {
    id: 'price', materialSku: 'ACC-PRICE', materialName: '价格吊牌', imageUrl: '/sample/price.jpg', color: '白', spec: '35×60mm', unit: '张',
    requiredQty: 100, preparedQty: 0, availableQty: 100, locationId: 'GTP-A01', purpose: '价格吊牌', requiresCutting: false,
    ...overrides,
  }
}
function preparation(overrides: Partial<AccessoryPreparation> = {}): AccessoryPreparation {
  return {
    id: 'PREP-1', productionOrderId: 'PO-1', productionOrderNo: 'SC-001', styleName: '连衣裙', styleImageUrl: '/sample/style.jpg',
    techPackVersion: 'TP-1-V2', cuttingFactoryId: 'FACTORY-SEA2', cuttingFactoryName: 'sea cutting2', version: 1, status: '待配料', remark: '',
    lines: [line(), line({ id: 'zip', materialSku: 'ACC-ZIP', materialName: '拉链', purpose: '其他', unit: '条' })], history: [], ...overrides,
  }
}
function fullPreparation(overrides: Partial<AccessoryPreparation> = {}): AccessoryPreparation {
  const base = preparation(overrides)
  return { ...base, lines: base.lines.map(item => ({ ...item, preparedQty: item.requiredQty, availableQty: 0 })) }
}
function createdTransfer(factoryName = 'sea cutting2'): AccessoryTransfer {
  return completeAccessoryPreparation(fullPreparation({ cuttingFactoryName: factoryName }), { ...ACTION, transferId: 'TR-1' }).transfer
}
function availability(transfer: AccessoryTransfer) {
  return Object.fromEntries(transfer.lines.map(item => [item.id, item.qty]))
}
function dispatchedTransfer(factoryName = 'sea cutting2'): AccessoryTransfer {
  const transfer = createdTransfer(factoryName)
  return dispatchAccessoryTransfer(transfer, ACTION, availability(transfer))
}
function receiptInput(transfer: AccessoryTransfer) {
  const warehouseCode = transfer.toWarehouse!
  return {
    ...ACTION, warehouseCode,
    lines: transfer.lines.map(item => ({ lineId: item.id, qty: item.qty, locationId: `${warehouseCode}-A01` })),
    locations: [{ id: `${warehouseCode}-A01`, warehouseCode, enabled: true }],
  }
}
function receivedTransfer(factoryName = 'sea cutting2'): AccessoryTransfer {
  const transfer = dispatchedTransfer(factoryName)
  return receiveAccessoryTransfer(transfer, receiptInput(transfer))
}
function changeInput(newFactoryName = 'sea cutting') {
  return { ...ACTION, changeId: 'CH-1', transferId: 'TR-CHANGE', newFactoryId: 'FACTORY-NEW', newFactoryName, reason: '裁剪任务改派', releasedQtyByLine: {} }
}
function pickupInput() {
  return { id: 'PICKUP-1', taskId: 'TASK-1', assignmentId: 'ASSIGN-1', taskVersion: 'v2', taskType: 'SEWING' as const, factoryId: 'SEW-1', factoryName: '三方车缝厂', quantitiesByLine: { price: 60 } }
}

test('工厂映射使用明确名称；待定和未知工厂不默认到 HILON', () => {
  assert.equal(getAccessoryWarehouseForCuttingFactory('sea cutting'), HILON)
  assert.equal(getAccessoryWarehouseForCuttingFactory(' sea cutting2 '), MAHAMERU)
  assert.equal(getAccessoryWarehouseForCuttingFactory(null), null)
  assert.equal(getAccessoryWarehouseForCuttingFactory('Hilon'), null)
  assert.equal(getAccessoryWarehouseForCuttingFactory('其它裁床'), null)
})

test('登记配料按行累计，保留单位和来源库位，不修改输入', () => {
  const source = preparation(), before = structuredClone(source)
  const next = registerAccessoryPreparation(source, [{ lineId: 'price', qty: 30, locationId: 'GTP-A02' }], ACTION)
  assert.deepEqual(source, before)
  assert.equal(next.status, '配料中')
  assert.equal(next.version, 2)
  assert.equal(next.lines[0].preparedQty, 30)
  assert.equal(next.lines[0].availableQty, 70)
  assert.equal(next.lines[0].locationId, 'GTP-A02')
  assert.equal(next.lines[0].unit, '张')
  assert.equal(getAccessoryPreparationRemaining(next.lines[0]), 70)
  assert.equal(next.lines[1].preparedQty, 0)
  assert.match(next.history[0].detail, /30张/)
  assert.deepEqual(Object.keys(next.history[0]).sort(), ['action', 'at', 'by', 'detail'])
  const otherLocation = registerAccessoryPreparation(next, [{ lineId: 'price', qty: 1, locationId: 'GTP-OTHER' }], ACTION)
  assert.deepEqual(otherLocation.lines[0].allocations, [{ locationId: 'GTP-A02', qty: 30 }, { locationId: 'GTP-OTHER', qty: 1 }])
  assert.equal(otherLocation.lines[0].locationId, 'GTP-A02')
})

test('旧单已配保留原库位，新配可用不同库位并合并同库位片段，合计等于实配', () => {
  const source = preparation({ lines: [line({ preparedQty: 30, availableQty: 70, locationId: 'LEGACY-GTP-A01' })] })
  const first = registerAccessoryPreparation(source, [{ lineId: 'price', qty: 50, locationId: 'GTP-NEW-A01' }], ACTION)
  const completed = registerAccessoryPreparation(first, [{ lineId: 'price', qty: 20, locationId: 'LEGACY-GTP-A01' }], ACTION)
  assert.equal(source.lines[0].allocations, undefined)
  assert.deepEqual(completed.lines[0].allocations, [{ locationId: 'LEGACY-GTP-A01', qty: 50 }, { locationId: 'GTP-NEW-A01', qty: 50 }])
  assert.equal(completed.lines[0].allocations!.reduce((sum, allocation) => sum + allocation.qty, 0), completed.lines[0].preparedQty)
  const result = completeAccessoryPreparation(completed, { ...ACTION, transferId: 'MULTI-LOCATION' })
  assert.deepEqual(result.transfer.lines.map(row => [row.sourceLineId, row.qty, row.fromLocationId]), [
    ['price', 50, 'LEGACY-GTP-A01'], ['price', 50, 'GTP-NEW-A01'],
  ])
  assert.equal(new Set(result.transfer.lines.map(row => row.id)).size, 2)
  const reordered = { ...result.preparation, lines: result.preparation.lines.map(row => ({ ...row, allocations: [...row.allocations!].reverse() })) }
  assert.equal(completeAccessoryPreparation(reordered, { ...ACTION, transferId: 'REPEAT' }, result.transfer).transfer, result.transfer)
  const sent = dispatchAccessoryTransfer(result.transfer, ACTION, availability(result.transfer))
  assert.equal(receiveAccessoryTransfer(sent, receiptInput(sent)).status, '已收货')
  assert.throws(() => receiveAccessoryTransfer(sent, { ...receiptInput(sent), lines: receiptInput(sent).lines.slice(0, 1) }), codes('PARTIAL_TRANSFER'))
})

test('分配片段合计不符或缺失来源时拒绝保存，不修饰错误来源', () => {
  const bad = preparation({ lines: [line({ preparedQty: 30, allocations: [{ locationId: 'A', qty: 20 }] })] })
  assert.throws(() => registerAccessoryPreparation(bad, [{ lineId: 'price', qty: 10, locationId: 'B' }], ACTION), codes('ALLOCATION_QUANTITY_CONFLICT'))
  assert.equal(bad.lines[0].preparedQty, 30)
  assert.throws(() => getAccessoryLineAllocations(line({ preparedQty: 20, locationId: '' })), codes('MISSING_LOCATION'))
  assert.deepEqual(getAccessoryLineAllocations(line({ preparedQty: 20, locationId: 'LEGACY' })), [{ locationId: 'LEGACY', qty: 20 }])
})

test('无效、重复、超待配、超库存和需裁剪配料逐一阻断', () => {
  for (const qty of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => registerAccessoryPreparation(preparation(), [{ lineId: 'price', qty, locationId: 'GTP-A01' }], ACTION), codes('INVALID_QUANTITY'))
  }
  assert.throws(() => registerAccessoryPreparation(preparation(), [], ACTION), codes('EMPTY_PREPARATION'))
  assert.throws(() => registerAccessoryPreparation(preparation(), [{ lineId: 'x', qty: 1, locationId: 'a' }], ACTION), codes('UNKNOWN_LINE'))
  assert.throws(() => registerAccessoryPreparation(preparation(), [{ lineId: 'price', qty: 1, locationId: 'a' }, { lineId: 'price', qty: 2, locationId: 'a' }], ACTION), codes('DUPLICATE_LINE'))
  assert.throws(() => registerAccessoryPreparation(preparation(), [{ lineId: 'price', qty: 101, locationId: 'a' }], ACTION), codes('OVER_PREPARATION'))
  assert.throws(() => registerAccessoryPreparation(preparation({ lines: [line({ availableQty: 20 })] }), [{ lineId: 'price', qty: 21, locationId: 'a' }], ACTION), codes('INSUFFICIENT_STOCK'))
  assert.throws(() => registerAccessoryPreparation(preparation({ lines: [line({ requiresCutting: true })] }), [{ lineId: 'price', qty: 1, locationId: 'a' }], ACTION), codes('CUTTING_MATERIAL'))
  assert.throws(() => registerAccessoryPreparation(preparation(), [{ lineId: 'price', qty: 1, locationId: '' }], ACTION), codes('MISSING_LOCATION'))
})

test('逐行配齐不能总量抵消；超过应配和空包也不能完成', () => {
  const source = fullPreparation()
  source.lines[0].preparedQty = 101
  source.lines[1].preparedQty = 99
  assert.throws(() => completeAccessoryPreparation(source, { ...ACTION, transferId: 'TR' }), codes('NOT_FULLY_PREPARED'))
  assert.throws(() => completeAccessoryPreparation(preparation({ lines: [] }), { ...ACTION, transferId: 'TR' }), codes('EMPTY_PREPARATION'))
  assert.equal(source.status, '待配料')
})

test('全部配齐自动建立整单但不出库；工厂待定也有唯一调拨身份', () => {
  const source = fullPreparation({ cuttingFactoryId: null, cuttingFactoryName: null })
  const completed = completeAccessoryPreparation(source, { ...ACTION, transferId: 'TR-PENDING' })
  assert.equal(completed.preparation.status, '已配齐')
  assert.equal(completed.preparation.completedAt, ACTION.at)
  assert.equal(completed.preparation.completionVersion, 2)
  assert.equal(completed.transfer.id, 'TR-PENDING')
  assert.equal(completed.transfer.status, '待定调入方')
  assert.equal(completed.transfer.fromWarehouse, GTP)
  assert.equal(completed.transfer.toWarehouse, null)
  assert.equal(completed.transfer.dispatchedAt, undefined)
  assert.equal(completed.transfer.lines[0].qty, 100)
  assert.equal(completed.transfer.lines[0].unit, '张')
  const repeated = completeAccessoryPreparation(completed.preparation, { ...ACTION, transferId: 'SHOULD-NOT-CREATE' }, completed.transfer)
  assert.equal(repeated.transfer, completed.transfer)
  assert.equal(repeated.preparation, completed.preparation)
  assert.throws(() => dispatchAccessoryTransfer(completed.transfer, ACTION, availability(completed.transfer)), codes('TRANSFER_NOT_DISPATCHABLE'))
})

test('已确认工厂必须有档案身份；未知映射不猜仓', () => {
  assert.throws(() => completeAccessoryPreparation(fullPreparation({ cuttingFactoryId: 'F-X', cuttingFactoryName: 'unknown' }), { ...ACTION, transferId: 'TR' }), codes('UNKNOWN_FACTORY'))
  assert.throws(() => completeAccessoryPreparation(fullPreparation({ cuttingFactoryId: null }), { ...ACTION, transferId: 'TR' }), codes('UNKNOWN_FACTORY'))
  const result = completeAccessoryPreparation(fullPreparation(), { ...ACTION, transferId: 'TR' })
  assert.equal(result.transfer.toWarehouse, MAHAMERU)
  assert.equal(result.transfer.status, '待出库')
  assert.throws(() => registerAccessoryPreparation(result.preparation, [{ lineId: 'price', qty: 1, locationId: 'a' }], ACTION), codes('PREPARATION_COMPLETED'))
})

test('阶段一已配齐切换保留真实完成事实；补建时间独立且重放不重单', () => {
  const source = fullPreparation({ status: '已配齐', version: 9, completedAt: '2026-10-18 14:00:00', completedBy: '原仓管', completionVersion: 9 })
  const result = completeAccessoryPreparation(source, { ...ACTION, transferId: 'BACKFILL-1' })
  assert.equal(result.preparation, source)
  assert.equal(result.preparation.completedAt, '2026-10-18 14:00:00')
  assert.equal(result.preparation.completedBy, '原仓管')
  assert.equal(result.transfer.createdAt, ACTION.at)
  assert.equal(result.transfer.history[0].action, '历史已配齐切换补建')
  assert.equal(result.transfer.dispatchedAt, undefined)
  assert.equal(completeAccessoryPreparation(source, { ...ACTION, transferId: 'BACKFILL-2' }, result.transfer).transfer.id, 'BACKFILL-1')
  assert.throws(() => completeAccessoryPreparation(source, { ...ACTION, transferId: 'BACKFILL-2' }, { ...result.transfer, productionOrderId: 'OTHER-PO' }), codes('TRANSFER_SOURCE_CONFLICT'))
})

test('待定补充目的仓保持调拨身份；实际出库后禁止改写目的仓', () => {
  const pending = completeAccessoryPreparation(fullPreparation({ cuttingFactoryId: null, cuttingFactoryName: null }), { ...ACTION, transferId: 'TR-1' }).transfer
  const next = setAccessoryTransferDestination(pending, HILON, ACTION)
  assert.equal(next.id, pending.id)
  assert.equal(next.status, '待出库')
  assert.equal(pending.toWarehouse, null)
  const dispatched = dispatchAccessoryTransfer(next, ACTION, availability(next))
  assert.throws(() => setAccessoryTransferDestination(dispatched, MAHAMERU, ACTION), codes('TRANSFER_ALREADY_DISPATCHED'))
})

test('整单出库任一行可用量不足就全部拒绝；单位不混加', () => {
  const source = createdTransfer(), before = structuredClone(source)
  assert.throws(() => dispatchAccessoryTransfer(source, ACTION, { price: 1000, zip: 99 }), codes('INSUFFICIENT_STOCK'))
  assert.deepEqual(source, before)
  const next = dispatchAccessoryTransfer(source, ACTION, availability(source))
  assert.equal(next.status, '已出库待收货')
  assert.equal(next.dispatchedAt, ACTION.at)
  assert.equal(next.receivedAt, undefined)
  assert.deepEqual(next.lines.map(row => [row.qty, row.unit]), [[100, '张'], [100, '条']])
  assert.throws(() => dispatchAccessoryTransfer(next, ACTION, availability(next)), codes('TRANSFER_NOT_DISPATCHABLE'))
  assert.throws(() => dispatchAccessoryTransfer({ ...source, toWarehouse: DLN }, ACTION, availability(source)), codes('INVALID_DESTINATION'))
})

test('两仓均以一次确认完成完整收货和上架，保持原出库时间', () => {
  for (const factoryName of ['sea cutting', 'sea cutting2']) {
    const source = dispatchedTransfer(factoryName), before = structuredClone(source)
    const next = receiveAccessoryTransfer(source, receiptInput(source))
    assert.deepEqual(source, before)
    assert.equal(next.status, '已收货')
    assert.equal(next.dispatchedAt, source.dispatchedAt)
    assert.equal(next.receivedAt, ACTION.at)
    assert.ok(next.lines.every(item => item.toLocationId === `${source.toWarehouse}-A01`))
    assert.equal(next.history.at(-1)?.action, '收货入库并上架')
    assert.deepEqual(Object.keys(next.history.at(-1)!).sort(), ['action', 'at', 'by', 'detail'])
    assert.throws(() => receiveAccessoryTransfer(next, receiptInput(next)), codes('TRANSFER_NOT_RECEIVABLE'))
  }
})

test('未出库、部分、差异、错仓、停用及他仓库位收货均不落结果', () => {
  const source = dispatchedTransfer(), input = receiptInput(source), before = structuredClone(source)
  assert.throws(() => receiveAccessoryTransfer(createdTransfer(), input), codes('TRANSFER_NOT_RECEIVABLE'))
  assert.throws(() => receiveAccessoryTransfer(source, { ...input, lines: input.lines.slice(0, 1) }), codes('PARTIAL_TRANSFER'))
  assert.throws(() => receiveAccessoryTransfer(source, { ...input, lines: input.lines.map((row, i) => i ? row : { ...row, qty: 99 }) }), codes('RECEIPT_DIFFERENCE'))
  assert.throws(() => receiveAccessoryTransfer(source, { ...input, warehouseCode: HILON }), codes('WRONG_RECEIVING_WAREHOUSE'))
  assert.throws(() => receiveAccessoryTransfer(source, { ...input, locations: input.locations.map(row => ({ ...row, enabled: false })) }), codes('INVALID_RECEIVING_LOCATION'))
  assert.throws(() => receiveAccessoryTransfer(source, { ...input, locations: input.locations.map(row => ({ ...row, warehouseCode: HILON })) }), codes('INVALID_RECEIVING_LOCATION'))
  assert.deepEqual(source, before)
})

test('后道明确排除四类，不能凭名称关键词反转；需裁剪物料不纳入', () => {
  const lines = [
    ...(['价格吊牌', '品牌吊牌', '吊粒', '车缝线'] as const).map((purpose, index) => line({ id: String(index), purpose })),
    line({ id: 'other', materialName: '名字含吊牌但已核对为其他用途', purpose: '其他' }),
    line({ id: 'cut', requiresCutting: true, purpose: '其他' }),
  ]
  const split = splitAccessoryLinesForTask(lines, 'SEWING')
  assert.deepEqual(split.sewingLines.map(row => row.purpose), ['价格吊牌', '品牌吊牌', '吊粒', '车缝线'])
  assert.deepEqual(split.postLines.map(row => row.id), ['other'])
  assert.equal(splitAccessoryLinesForTask(lines, 'SEWING_IRONING_PACKING').postLines.length, 0)
  assert.equal(splitAccessoryLinesForTask(lines, 'CUTTING_SEWING_IRONING_PACKING').sewingLines.length, 5)
  assert.throws(() => splitAccessoryLinesForTask([line({ purpose: '待核对' })], 'SEWING'), codes('UNKNOWN_PURPOSE'))
})

test('领料按有效任务范围建清单，不重复使用生产单总量或后道份额', () => {
  const source = receivedTransfer(), input = pickupInput()
  const pickup = createAccessoryPickup(source, input)
  assert.equal(pickup.sourceTransferId, source.id)
  assert.equal(pickup.taskId, 'TASK-1')
  assert.equal(pickup.assignmentId, 'ASSIGN-1')
  assert.equal(pickup.lines.length, 1)
  assert.equal(pickup.lines[0].requiredQty, 60)
  assert.equal(pickup.lines[0].handedQty, 0)
  assert.equal(pickup.lines[0].fromLocationId, `${MAHAMERU}-A01`)
  assert.throws(() => createAccessoryPickup(dispatchedTransfer(), input), codes('SOURCE_NOT_RECEIVED'))
  assert.throws(() => createAccessoryPickup(source, { ...input, taskVersion: '' }), codes('TASK_NOT_ASSIGNED'))
  assert.throws(() => createAccessoryPickup(source, { ...input, quantitiesByLine: { price: 101 } }), codes('OVER_TASK_QUANTITY'))
  assert.throws(() => createAccessoryPickup(source, { ...input, quantitiesByLine: { zip: 50 } }), codes('UNKNOWN_LINE'))
})

test('仓库允许分次实交，累计只扣本次数量；最后一次完成领料', () => {
  const pickup = createAccessoryPickup(receivedTransfer(), pickupInput()), before = structuredClone(pickup)
  const first = recordAccessoryPickup(pickup, { ...ACTION, taskVersion: 'v2', role: 'WAREHOUSE', entries: [{ lineId: 'price', qty: 20 }] }, { price: 100 })
  assert.deepEqual(pickup, before)
  assert.equal(first.lines[0].handedQty, 20)
  assert.equal(first.status, '领料中')
  const last = recordAccessoryPickup(first, { ...ACTION, taskVersion: 'v2', role: 'WAREHOUSE', entries: [{ lineId: 'price', qty: 40 }] }, { price: 80 })
  assert.equal(last.lines[0].handedQty, 60)
  assert.equal(last.status, '已领料')
  assert.equal(last.history.length, 2)
})

test('PPIC不能代确认；旧版本、超应领、超实物可用和重复明细阻断', () => {
  const pickup = createAccessoryPickup(receivedTransfer(), pickupInput())
  const input = { ...ACTION, taskVersion: 'v2', role: 'WAREHOUSE' as const, entries: [{ lineId: 'price', qty: 20 }] }
  assert.throws(() => recordAccessoryPickup(pickup, { ...input, role: 'PPIC' }, { price: 100 }), codes('WAREHOUSE_CONFIRMATION_REQUIRED'))
  assert.throws(() => recordAccessoryPickup(pickup, { ...input, role: 'FACTORY' }, { price: 100 }), codes('WAREHOUSE_CONFIRMATION_REQUIRED'))
  assert.throws(() => recordAccessoryPickup(pickup, { ...input, taskVersion: 'v1' }, { price: 100 }), codes('STALE_TASK_VERSION'))
  assert.throws(() => recordAccessoryPickup(pickup, { ...input, entries: [{ lineId: 'price', qty: 61 }] }, { price: 100 }), codes('OVER_PICKUP'))
  assert.throws(() => recordAccessoryPickup(pickup, input, { price: 19 }), codes('INSUFFICIENT_STOCK'))
  assert.throws(() => recordAccessoryPickup(pickup, { ...input, entries: [...input.entries, ...input.entries] }, { price: 100 }), codes('DUPLICATE_LINE'))
})

test('HILON与Mahameru后道调拨均经过实际出库及DLN接收，四类未混入', () => {
  for (const factoryName of ['sea cutting', 'sea cutting2']) {
    const source = receivedTransfer(factoryName)
    const post = createAccessoryPostTransfer(source, { ...ACTION, id: `POST-${source.toWarehouse}`, taskType: 'SEWING', responsibilityKey: 'TASK-1-v2', quantitiesByLine: { zip: 60 } })
    assert.equal(post.kind, 'SITE_TO_POST')
    assert.equal(post.fromWarehouse, source.toWarehouse)
    assert.equal(post.toWarehouse, DLN)
    assert.equal(post.lines[0].id, 'zip')
    assert.equal(post.lines[0].qty, 60)
    assert.equal(post.status, '待出库')
    const dispatched = dispatchAccessoryTransfer(post, ACTION, { zip: 100 })
    const received = receiveAccessoryTransfer(dispatched, { ...receiptInput(dispatched), ...POST_ACTION })
    assert.equal(received.status, '已收货')
    assert.equal(received.receivedBy, 'DLN仓管')
    assert.equal(source.status, '已收货')
  }
})

test('后道不接受含烫包责任、未收货来源或四类物料冒充', () => {
  const input = { ...ACTION, id: 'POST-1', taskType: 'SEWING' as const, responsibilityKey: 'RESP-1', quantitiesByLine: { zip: 60 } }
  assert.throws(() => createAccessoryPostTransfer(receivedTransfer(), { ...input, taskType: 'SEWING_IRONING_PACKING' }), codes('NO_POST_SPLIT'))
  assert.throws(() => createAccessoryPostTransfer(dispatchedTransfer(), input), codes('SOURCE_NOT_RECEIVED'))
  assert.throws(() => createAccessoryPostTransfer(receivedTransfer(), { ...input, quantitiesByLine: { price: 10 } }), codes('UNKNOWN_LINE'))
})

test('未出GTP改厂保持首次调拨身份，取消旧仓预入库并生成新目的方', () => {
  const source = createdTransfer(), prep = fullPreparation()
  const result = planAccessoryCuttingFactoryChange(prep, source, changeInput())
  assert.equal(result.mode, 'UPDATE_DESTINATION')
  assert.equal(result.currentTransfer?.id, source.id)
  assert.equal(result.currentTransfer?.toWarehouse, HILON)
  assert.equal(result.currentTransfer?.status, '待出库')
  assert.deepEqual(result.cancelledReceipt, { transferId: source.id, warehouseCode: MAHAMERU, reason: '裁剪任务改派' })
  assert.equal(result.onwardTransfer, null)
  assert.equal(result.preparation.cuttingFactoryName, 'sea cutting')
  assert.equal(source.toWarehouse, MAHAMERU)
  assert.equal(prep.cuttingFactoryName, 'sea cutting2')
})

test('已出GTP在途改厂不改写原目的仓，原仓收货后才能建立后续调拨', () => {
  const source = dispatchedTransfer(), result = planAccessoryCuttingFactoryChange(fullPreparation(), source, changeInput())
  assert.equal(result.mode, 'WAIT_ORIGINAL_RECEIPT')
  assert.equal(result.currentTransfer, source)
  assert.equal(result.currentTransfer?.toWarehouse, MAHAMERU)
  assert.equal(result.cancelledReceipt, null)
  assert.equal(result.onwardTransfer, null)
  assert.equal(result.reassignment?.status, '等待原仓收货')
  assert.throws(() => createAccessoryReassignmentTransfer(source, result.reassignment!, { ...ACTION, transferId: 'TR-NEXT' }), codes('SOURCE_NOT_RECEIVED'))
  const originalReceived = receiveAccessoryTransfer(source, receiptInput(source))
  const onward = createAccessoryReassignmentTransfer(originalReceived, result.reassignment!, { ...ACTION, transferId: 'TR-NEXT' })
  assert.equal(onward.fromWarehouse, MAHAMERU)
  assert.equal(onward.toWarehouse, HILON)
  assert.equal(onward.status, '待出库')
  assert.ok(onward.lines.every(row => row.fromLocationId === `${MAHAMERU}-A01`))
  assert.equal(originalReceived.toWarehouse, MAHAMERU)
  assert.equal(originalReceived.status, '已收货')
})

test('原仓已收货改厂双向建立整单仓间调拨，历史和单位保留', () => {
  for (const [oldFactory, newFactory, from, to] of [
    ['sea cutting2', 'sea cutting', MAHAMERU, HILON],
    ['sea cutting', 'sea cutting2', HILON, MAHAMERU],
  ]) {
    const source = receivedTransfer(oldFactory)
    const result = planAccessoryCuttingFactoryChange(fullPreparation({ cuttingFactoryName: oldFactory }), source, changeInput(newFactory))
    assert.equal(result.mode, 'CREATE_REASSIGN_TRANSFER')
    assert.equal(result.currentTransfer, source)
    assert.equal(result.onwardTransfer?.kind, 'SITE_REASSIGN')
    assert.equal(result.onwardTransfer?.sourceTransferId, source.id)
    assert.equal(result.onwardTransfer?.changeId, 'CH-1')
    assert.equal(result.onwardTransfer?.fromWarehouse, from)
    assert.equal(result.onwardTransfer?.toWarehouse, to)
    assert.deepEqual(result.onwardTransfer?.lines.map(row => [row.id, row.qty, row.unit]), source.lines.map(row => [row.id, row.qty, row.unit]))
    const sent = dispatchAccessoryTransfer(result.onwardTransfer!, ACTION, availability(result.onwardTransfer!))
    assert.equal(receiveAccessoryTransfer(sent, receiptInput(sent)).status, '已收货')
  }
})

test('已有实交量禁止整包改厂；缺原因和错来源不能关联，未配齐也不提前造单', () => {
  const source = receivedTransfer()
  assert.throws(() => planAccessoryCuttingFactoryChange(fullPreparation(), source, { ...changeInput(), releasedQtyByLine: { price: 1 } }), codes('ALREADY_RELEASED'))
  assert.throws(() => planAccessoryCuttingFactoryChange(fullPreparation(), source, { ...changeInput(), reason: '' }), codes('INVALID_FACTORY_CHANGE'))
  assert.throws(() => planAccessoryCuttingFactoryChange(fullPreparation(), { ...source, preparationId: 'OTHER' }, changeInput()), codes('TRANSFER_SOURCE_CONFLICT'))
  const pending = planAccessoryCuttingFactoryChange(preparation(), null, changeInput())
  assert.equal(pending.mode, 'NO_TRANSFER')
  assert.equal(pending.currentTransfer, null)
  assert.equal(pending.onwardTransfer, null)
  assert.equal(pending.preparation.status, '待配料')
})

test('相同目的仓不重复制造调拨；小数数量保持逐行守恒', () => {
  const source = receivedTransfer()
  const result = planAccessoryCuttingFactoryChange(fullPreparation(), source, changeInput('sea cutting2'))
  assert.equal(result.mode, 'UNCHANGED_DESTINATION')
  assert.equal(result.onwardTransfer, null)
  const prep = preparation({ lines: [line({ unit: '米', requiredQty: 0.3, availableQty: 0.3 })] })
  const first = registerAccessoryPreparation(prep, [{ lineId: 'price', qty: 0.1, locationId: 'GTP-A01' }], ACTION)
  const last = registerAccessoryPreparation(first, [{ lineId: 'price', qty: 0.2, locationId: 'GTP-A01' }], ACTION)
  assert.equal(last.lines[0].preparedQty, 0.3)
  assert.equal(last.lines[0].availableQty, 0)
  assert.equal(completeAccessoryPreparation(last, { ...ACTION, transferId: 'DECIMAL' }).transfer.lines[0].qty, 0.3)
})
