import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createFinishedInventoryBaseSeed as createFinishedInventorySeed, FINISHED_INVENTORY_LOCATIONS, FINISHED_INVENTORY_NORMAL_WAREHOUSE, FINISHED_INVENTORY_DEFECT_WAREHOUSE, FINISHED_INVENTORY_REWORK_FACTORY } from '../../src/data/wls/finished-inventory-quality-seed.ts'
import { restoreFinishedInventoryState, captureFinishedInventoryState, readFinishedInventoryState, prepareFinishedInventoryCommit } from '../../src/data/wls/finished-inventory-records.ts'
import { listFinishedInventoryLots, previewFinishedInventoryQuality, createFinishedInventoryQualityApplication, registerFinishedInventoryQcBridge, receiveFinishedInventoryQualityApplication,
  completeFinishedInventoryQc, listFinishedInventoryTransfers, listFinishedInventoryDifferences, shipFinishedInventoryTransfer, receiveFinishedInventoryTransfer,
  putawayFinishedInventoryTransfer, resolveFinishedInventoryDifference, getFinishedInventoryApplication, finishedInventoryAvailability, finishedInventoryRealtimeRows,
  listFinishedInventoryOutboundOrders, finishedInventoryOnlineRows, finishedInventoryLocationRows, finishedInventoryFlowRows, finishedInventoryApplicationStatus } from '../../src/data/wls/finished-inventory-quality.ts'

const actor = { actorId: 'TEST-WH-USER', actorName: '隔离仓管', roleName: '仓库收货人员' }
const time = '2026-10-22T10:00:00+07:00'
let seq = 0
beforeEach(() => {
  restoreFinishedInventoryState(createFinishedInventorySeed())
  // 仅隔离领域契约：真实QC同库接入由后道桥/浏览器集成单独验证。
  registerFinishedInventoryQcBridge({ receiveIntoQc: input => ({ qcTaskId: `QC-${input.applicationId}`, qcTaskNo: `QCN-${input.applicationNo}` }) })
})
function preview() { const first = listFinishedInventoryLots()[0]!; return previewFinishedInventoryQuality(first.warehouseId, first.styleId) }
function create() { return createFinishedInventoryQualityApplication({ preview: preview(), operationId: `inventory-unit-${++seq}`, actor, at: time }) }
function receive(delta = 0) {
  const application = create()
  return receiveFinishedInventoryQualityApplication({ applicationId: application.id, quantities: application.lines.map((line, i) => ({ skuId: line.skuId, quantity: line.outboundQty + (i === 0 ? delta : 0) })), actor, at: time })
}
function qc(mode: 'sample' | 'full' | 'rework' = 'sample') {
  const application = receive()
  const results = application.lines.map((line, i) => {
    const inspectedQty = mode === 'sample' ? i === 0 ? 24 : 0 : line.receivedQty!
    const defectQty = i === 0 ? mode === 'sample' ? 1 : 2 : 0, reworkQty = i === 0 && mode === 'rework' ? 3 : 0
    return { skuId: line.skuId, inspectedQty, passedQty: inspectedQty - defectQty - reworkQty, defectQty, reworkQty }
  })
  return completeFinishedInventoryQc({ applicationId: application.id, qcTaskId: application.qcTaskId!, results, completedAt: time, operatorName: actor.actorName })
}
function finish(transferId: string, short = 0) {
  const transfer = shipFinishedInventoryTransfer({ transferId, actor, at: time })
  const received = receiveFinishedInventoryTransfer({ transferId, targetId: transfer.targetId, quantities: transfer.lines.map((line, i) => ({ skuId: line.skuId, quantity: line.quantity - (i === 0 ? short : 0) })), actor, at: time })
  if (received.category !== '返工交接') putawayFinishedInventoryTransfer({ transferId, locations: received.lines.filter(line => line.receivedQty! > 0).map(line => ({ skuId: line.skuId, locationCode: FINISHED_INVENTORY_LOCATIONS.find(row => row.warehouseId === received.targetId)!.locationCode })), actor, at: time })
}
const normalTotal = () => listFinishedInventoryLots().filter(row => row.warehouseId === FINISHED_INVENTORY_NORMAL_WAREHOUSE.id && row.styleId === 'style_r1_wms_tee' && row.quality === '正常').reduce((a, row) => a + row.quantity, 0)

test('一仓一款汇集所有SKU库位；同订单行三阶段不重复，瑕疵破损不纳入', () => {
  const result = preview()
  assert.equal(result.totalNormal, 100); assert.equal(result.excludedQty, 20); assert.equal(result.eligibleQty, 80)
  assert.equal(result.lines.length, 2); assert.ok(result.lines.every(row => row.allocations.length === 2))
  assert.ok(result.lines.every(row => row.imageUrl.startsWith('/materials/pcs-reviewed/')))
  assert.ok(result.lines.every(row => row.styleId === 'style_r1_wms_tee'))
})
test('确认申请即整批真实扣库，只有一个已交出出库和无生产来源待收事实', () => {
  const app = create(); assert.equal(normalTotal(), 20)
  const transfers = listFinishedInventoryTransfers(app.id)
  assert.equal(transfers.length, 1); assert.equal(transfers[0]!.category, '送后道'); assert.ok(transfers[0]!.shippedAt); assert.equal(transfers[0]!.receivedAt, undefined)
  assert.equal((app as unknown as Record<string, unknown>).productionOrderId, undefined)
  assert.ok(!JSON.stringify(captureFinishedInventoryState()).includes('冻结'))
  assert.equal(finishedInventoryFlowRows().filter(row => row.actionType === '送检出库').reduce((a, row) => a + row.outboundChange, 0), -80)
})
test('稳定操作身份重试返回原申请，不再次扣库或生成出库', () => {
  const p = preview(), operationId = `dedupe-${++seq}`
  const a = createFinishedInventoryQualityApplication({ preview: p, operationId, actor, at: time })
  const b = createFinishedInventoryQualityApplication({ preview: p, operationId, actor, at: time })
  assert.equal(a.id, b.id); assert.equal(normalTotal(), 20); assert.equal(listFinishedInventoryTransfers(a.id).length, 1)
})
test('过期预览能发现新增库位和新增订单，不能只校验原有行', () => {
  const p = preview(), state = readFinishedInventoryState()
  state.lots.push({ ...state.lots[0]!, id: 'NEW-LOT-SAME-STYLE', quantity: 4 })
  assert.throws(() => createFinishedInventoryQualityApplication({ preview: p, operationId: 'stale-lot', actor }), /已经变化/)
  const p2 = preview()
  state.exclusions.push({ ...state.exclusions[0]!, id: 'NEW-ORDER', orderLineId: 'NEW-ORDER-LINE', quantity: 2 })
  assert.throws(() => createFinishedInventoryQualityApplication({ preview: p2, operationId: 'stale-order', actor }), /已经变化/)
})
test('0资格、未知排除来源、排除量超过实物均阻断，原占用不释放', () => {
  create()
  assert.equal(preview().eligibleQty, 0)
  assert.throws(create, /没有可送检/)
  readFinishedInventoryState().exclusions[0]!.sourceRef = ''
  assert.throws(preview, /未知排除量/)
})
test('出80实收79及81保留两事实，QC基数分别79及81', () => {
  let app = receive(-1)
  assert.equal(app.lines.reduce((a, l) => a + l.outboundQty, 0), 80)
  assert.equal(app.lines.reduce((a, l) => a + l.receivedQty!, 0), 79); assert.equal(Math.ceil(79 * .3), 24)
  assert.equal(listFinishedInventoryDifferences(app.id)[0]!.quantity, -1)
  restoreFinishedInventoryState(createFinishedInventorySeed()); app = receive(1)
  assert.equal(app.lines.reduce((a, l) => a + l.receivedQty!, 0), 81); assert.equal(Math.ceil(81 * .3), 25)
  assert.equal(listFinishedInventoryDifferences(app.id)[0]!.quantity, 1)
  assert.equal(app.lines.reduce((a, l) => a + l.outboundQty, 0), 80)
})
test('后道整批实收为0没有QC，不能伪造完成，也不允许覆盖原实收', () => {
  const app = create()
  const received = receiveFinishedInventoryQualityApplication({ applicationId: app.id, quantities: app.lines.map(line => ({ skuId: line.skuId, quantity: 0 })), actor })
  assert.equal(received.qcTaskId, undefined); assert.equal(finishedInventoryApplicationStatus(received), '实收为0待核实差异')
  assert.equal(received.completedAt, undefined)
  assert.throws(() => receiveFinishedInventoryQualityApplication({ applicationId: app.id, quantities: app.lines.map(line => ({ skuId: line.skuId, quantity: line.outboundQty })), actor }), /已整批实收/)
})
test('错SKU、漏SKU和分批接收不能保存为整批实收', () => {
  const app = create(), lines = app.lines.map(line => ({ skuId: line.skuId, quantity: line.outboundQty }))
  assert.throws(() => receiveFinishedInventoryQualityApplication({ applicationId: app.id, quantities: lines.slice(0, 1), actor }), /不能漏项/)
  assert.throws(() => receiveFinishedInventoryQualityApplication({ applicationId: app.id, quantities: lines.map((l, i) => ({ ...l, skuId: i ? 'WRONG-SKU' : l.skuId })), actor }), /收错SKU/)
  assert.equal(getFinishedInventoryApplication(app.id)!.receivedAt, undefined)
})
test('抽检24中23合格1瑕疵：正常返79、实检合格23、未检56分别保留', () => {
  const app = qc(), rows = listFinishedInventoryTransfers(app.id).filter(row => row.category !== '送后道')
  assert.equal(app.qcResults!.reduce((a, r) => a + r.inspectedQty, 0), 24)
  assert.equal(app.qcResults!.reduce((a, r) => a + r.passedQty, 0), 23)
  assert.equal(app.qcResults!.reduce((a, r) => a + r.uninspectedQty, 0), 56)
  assert.equal(rows.find(row => row.category === '正常返仓')!.lines.reduce((a, r) => a + r.quantity, 0), 79)
  assert.equal(rows.find(row => row.category === '瑕疵入仓')!.targetId, FINISHED_INVENTORY_DEFECT_WAREHOUSE.id)
  assert.ok(!rows.some(row => row.category === '返工交接')); assert.equal(app.completedAt, undefined)
})
test('每SKU三类必须守恒，不能把其他SKU的实物借来填实检', () => {
  const app = receive()
  assert.throws(() => completeFinishedInventoryQc({ applicationId: app.id, qcTaskId: app.qcTaskId!, results: app.lines.map((line, i) => ({ skuId: line.skuId, inspectedQty: i === 0 ? line.receivedQty! + 1 : 0, passedQty: i === 0 ? line.receivedQty! + 1 : 0, defectQty: 0, reworkQty: 0 })) }), /本SKU实收/)
  assert.equal(listFinishedInventoryTransfers(app.id).length, 1)
})
test('正常返仓实收未上架不可售；另选本仓新库位上架后可售且全部流水同源', () => {
  const app = qc(), normal = listFinishedInventoryTransfers(app.id).find(row => row.category === '正常返仓')!
  shipFinishedInventoryTransfer({ transferId: normal.id, actor })
  receiveFinishedInventoryTransfer({ transferId: normal.id, targetId: normal.targetId, quantities: normal.lines.map(line => ({ skuId: line.skuId, quantity: line.quantity })), actor })
  assert.equal(finishedInventoryRealtimeRows().filter(r => r.styleId === app.styleId && r.warehouseId === app.warehouseId).reduce((a, r) => a + r.normalAvailableQuantity, 0), 0)
  putawayFinishedInventoryTransfer({ transferId: normal.id, locations: normal.lines.map(line => ({ skuId: line.skuId, locationCode: FINISHED_INVENTORY_LOCATIONS[2]!.locationCode })), actor })
  assert.equal(normalTotal(), 99)
  assert.equal(finishedInventoryRealtimeRows().filter(r => r.styleId === app.styleId && r.warehouseId === app.warehouseId).reduce((a, r) => a + r.normalAvailableQuantity, 0), 79)
  assert.ok(finishedInventoryLocationRows().some(row => row.warehouseLocation === FINISHED_INVENTORY_LOCATIONS[2]!.locationCode))
  assert.equal(finishedInventoryOnlineRows().filter(r => r.warehouseName === app.warehouseName && r.spu === app.styleNo).reduce((a, r) => a + r.available, 0), 79)
  assert.throws(() => putawayFinishedInventoryTransfer({ transferId: normal.id, locations: [], actor }), /已完成上架/)
})
test('全检78合格2瑕疵回原仓98、瑕疵另一仓2，全部交接上架后申请才完成', () => {
  const app = qc('full'), transfers = listFinishedInventoryTransfers(app.id).filter(row => row.category !== '送后道')
  assert.equal(transfers.length, 2)
  finish(transfers[0]!.id); assert.equal(getFinishedInventoryApplication(app.id)!.completedAt, undefined)
  finish(transfers[1]!.id); assert.ok(getFinishedInventoryApplication(app.id)!.completedAt)
  assert.equal(normalTotal(), 98)
  assert.equal(listFinishedInventoryLots().filter(row => row.warehouseId === FINISHED_INVENTORY_DEFECT_WAREHOUSE.id).reduce((a, row) => a + row.quantity, 0), 2)
})
test('75合格2瑕疵3返工：goto实际接收即分支完成，无返工后QC或可售', () => {
  const app = qc('rework'), transfers = listFinishedInventoryTransfers(app.id).filter(row => row.category !== '送后道'), rework = transfers.find(row => row.category === '返工交接')!
  assert.equal(rework.targetId, FINISHED_INVENTORY_REWORK_FACTORY.id)
  transfers.forEach(row => finish(row.id))
  assert.equal(normalTotal(), 95); assert.ok(getFinishedInventoryApplication(app.id)!.completedAt)
  assert.ok(!listFinishedInventoryLots().some(row => row.warehouseId === FINISHED_INVENTORY_REWORK_FACTORY.id))
  assert.equal(listFinishedInventoryTransfers(app.id).length, 4)
})
test('已QC仍有交接短差不完成；真实原因与去向确认不改QC或旧实收', () => {
  const app = qc('full'), transfers = listFinishedInventoryTransfers(app.id).filter(row => row.category !== '送后道')
  transfers.forEach(row => finish(row.id, row.category === '正常返仓' ? 1 : 0))
  assert.equal(getFinishedInventoryApplication(app.id)!.completedAt, undefined)
  const difference = listFinishedInventoryDifferences(app.id)[0]!, originalResults = getFinishedInventoryApplication(app.id)!.qcResults
  assert.throws(() => resolveFinishedInventoryDifference({ differenceId: difference.id, reason: '', disposition: '', actor }), /真实原因/)
  resolveFinishedInventoryDifference({ differenceId: difference.id, reason: '运输遗失已核实', disposition: '记录实际损耗1件，无回补入仓', actor })
  assert.ok(getFinishedInventoryApplication(app.id)!.completedAt)
  assert.deepEqual(getFinishedInventoryApplication(app.id)!.qcResults, originalResults)
  assert.equal(listFinishedInventoryDifferences(app.id)[0]!.actualQty, difference.actualQty)
})
test('跨仓接收、实际交出前接收、重复交出均阻断', () => {
  const app = qc(), normal = listFinishedInventoryTransfers(app.id).find(row => row.category === '正常返仓')!, quantities = normal.lines.map(line => ({ skuId: line.skuId, quantity: line.quantity }))
  assert.throws(() => receiveFinishedInventoryTransfer({ transferId: normal.id, targetId: normal.targetId, quantities, actor }), /先整批实际交出/)
  shipFinishedInventoryTransfer({ transferId: normal.id, actor })
  assert.throws(() => receiveFinishedInventoryTransfer({ transferId: normal.id, targetId: 'WRONG-WH', quantities, actor }), /仓库或返工工厂不一致/)
  assert.throws(() => shipFinishedInventoryTransfer({ transferId: normal.id, actor }), /不能分批或重复/)
})
test('参与者逐记录提交包含扣库/申请/出库/流水及范围CAS，不复制全部种子', () => {
  const before = captureFinishedInventoryState(); create(); const delta = prepareFinishedInventoryCommit(before)
  assert.ok(delta.puts.some(row => row.id.includes('/applications/')))
  assert.ok(delta.puts.some(row => row.id.includes('/transfers/')))
  assert.ok(delta.puts.some(row => row.id.includes('/movements/')))
  assert.ok(delta.puts.some(row => row.id.includes('/scopes/')))
  assert.ok(delta.puts.filter(row => row.id.includes('/lots/')).length < before.lots.length)
  assert.ok(!delta.puts.some(row => row.id.includes('/exclusions/')))
  assert.ok(delta.puts.every(row => row.expectedVersion === 0))
})
test('可售来源版本追踪同订单行排除身份阶段及仓款范围，不只记录实物或可售总量', () => {
  const state = readFinishedInventoryState(), sku = state.lots[0]!, before = finishedInventoryAvailability(sku.skuCode, sku.warehouseId)!
  const exclusion = state.exclusions.find(row => row.skuId === sku.skuId)!
  exclusion.quantity += 7
  const quantityChanged = finishedInventoryAvailability(sku.skuCode, sku.warehouseId)!
  assert.equal(quantityChanged.available, before.available - 7)
  assert.notEqual(quantityChanged.sourceVersion, before.sourceVersion)
  exclusion.sourceRef = '明确核对后的订单来源版本2'
  const identityChanged = finishedInventoryAvailability(sku.skuCode, sku.warehouseId)!
  assert.equal(identityChanged.available, quantityChanged.available)
  assert.notEqual(identityChanged.sourceVersion, quantityChanged.sourceVersion)
  exclusion.stage = '待出库'
  const stageChanged = finishedInventoryAvailability(sku.skuCode, sku.warehouseId)!
  assert.equal(stageChanged.available, identityChanged.available)
  assert.notEqual(stageChanged.sourceVersion, identityChanged.sourceVersion)
  state.scopes.push({ id: `${sku.warehouseId}::${sku.styleId}`, warehouseId: sku.warehouseId, styleId: sku.styleId, revision: 1 })
  const scopeChanged = finishedInventoryAvailability(sku.skuCode, sku.warehouseId)!
  assert.notEqual(scopeChanged.sourceVersion, stageChanged.sourceVersion)
  const version = JSON.parse(scopeChanged.sourceVersion)
  assert.ok(version.exclusions.some((row: { sourceRef: string }) => row.sourceRef === exclusion.sourceRef))
  assert.ok(version.scopes.some((row: { id: string; revision: number }) => row.id === state.scopes[0]!.id && row.revision === state.scopes[0]!.revision))
})

test('送检逐库位只扣本仓本款，别仓同款、同仓别款、未上架及非正常品原样保留', () => {
  const state = readFinishedInventoryState(), source = state.lots[0]!
  state.lots.push(
    { ...source, id: 'SENTINEL-OTHER-WH', warehouseId: 'OTHER-WH', quantity: 17 },
    { ...source, id: 'SENTINEL-OTHER-STYLE', styleId: 'OTHER-STYLE', skuId: 'OTHER-SKU', quantity: 19 },
    { ...source, id: 'SENTINEL-NOT-PUTAWAY', putaway: false, quantity: 23 },
  )
  const before = captureFinishedInventoryState(), p = preview(), app = createFinishedInventoryQualityApplication({ preview: p, operationId: `scope-${++seq}`, actor, at: time })
  const after = captureFinishedInventoryState()
  for (const lot of before.lots) {
    const allocation = p.lines.flatMap(line => line.allocations).find(row => row.lotId === lot.id)
    const saved = after.lots.find(row => row.id === lot.id)!
    if (allocation) assert.equal(saved.quantity, lot.quantity - allocation.quantity)
    else assert.deepEqual(saved, lot)
  }
  assert.deepEqual(after.exclusions, before.exclusions)
  assert.ok(app.lines.every(line => line.styleId === p.styleId))
  assert.equal(app.lines.reduce((total, line) => total + line.outboundQty, 0), p.eligibleQty)
})

test('订单排除逐独立订单行取阶段最大量，再累加不同订单；三个阶段独立生效', () => {
  const state = readFinishedInventoryState(), source = state.lots[0]!, original = state.exclusions[0]!
  state.exclusions = []
  for (const stage of ['订单占用', '已拣货', '待出库'] as const) {
    state.exclusions = [{ ...original, id: `ONLY-${stage}`, warehouseId: source.warehouseId, skuId: source.skuId, stage, quantity: 3 }]
    assert.equal(preview().excludedQty, 3)
  }
  state.exclusions = [
    { ...original, id: 'ORDER-A-RESERVED', skuId: source.skuId, orderLineId: 'ORDER-A', stage: '订单占用', quantity: 2 },
    { ...original, id: 'ORDER-A-PICKED', skuId: source.skuId, orderLineId: 'ORDER-A', stage: '已拣货', quantity: 5 },
    { ...original, id: 'ORDER-A-OUTBOUND', skuId: source.skuId, orderLineId: 'ORDER-A', stage: '待出库', quantity: 4 },
    { ...original, id: 'ORDER-B', skuId: source.skuId, orderLineId: 'ORDER-B', quantity: 7 },
  ]
  assert.equal(preview().excludedQty, 12)
  state.exclusions[0]!.quantity = 1000
  assert.throws(preview, /排除量超过实际正常在库/)
})

test('提交不采用篡改的部分预览，重读全部资格并自动纳入新SKU库位', () => {
  const state = readFinishedInventoryState(), source = state.lots[0]!
  state.lots.push({ ...source, id: 'NEW-THIRD-SKU', skuId: 'THIRD-SKU', skuCode: 'THIRD-SKU-CODE', quantity: 11 })
  const p = preview(), expected = structuredClone(p.lines)
  assert.equal(p.lines.length, 3)
  p.lines = p.lines.slice(0, 1); p.lines[0]!.outboundQty = 1; p.lines[0]!.allocations = []; p.eligibleQty = 1
  const app = createFinishedInventoryQualityApplication({ preview: p, operationId: `whole-${++seq}`, actor, at: time })
  assert.deepEqual(app.lines, expected)
  assert.equal(app.lines.reduce((total, line) => total + line.outboundQty, 0), 91)
})

test('整批实收拒绝重复SKU、负数、小数及非有限数，不留部分实收或差异', () => {
  const app = create(), quantities = app.lines.map(line => ({ skuId: line.skuId, quantity: line.outboundQty })), before = captureFinishedInventoryState()
  for (const bad of [
    quantities.map(row => ({ ...row, skuId: quantities[0]!.skuId })),
    ...[-1, .5, NaN, Infinity].map(quantity => quantities.map((row, index) => ({ ...row, quantity: index ? row.quantity : quantity }))),
  ]) {
    assert.throws(() => receiveFinishedInventoryQualityApplication({ applicationId: app.id, quantities: bad, actor }), /重项|非负整数/)
    assert.deepEqual(captureFinishedInventoryState(), before)
  }
})

test('只有正常品尚未上架时申请仍未完成，正常上架后才结束', () => {
  const app = qc('full'), transfers = listFinishedInventoryTransfers(app.id).filter(row => row.category !== '送后道')
  const normal = transfers.find(row => row.category === '正常返仓')!, defect = transfers.find(row => row.category === '瑕疵入仓')!
  finish(defect.id)
  shipFinishedInventoryTransfer({ transferId: normal.id, actor, at: time })
  receiveFinishedInventoryTransfer({ transferId: normal.id, targetId: normal.targetId, quantities: normal.lines.map(line => ({ skuId: line.skuId, quantity: line.quantity })), actor, at: time })
  assert.equal(getFinishedInventoryApplication(app.id)!.completedAt, undefined)
  assert.ok(listFinishedInventoryTransfers(app.id).find(row => row.id === defect.id)!.putawayAt)
  putawayFinishedInventoryTransfer({ transferId: normal.id, locations: normal.lines.map(line => ({ skuId: line.skuId, locationCode: FINISHED_INVENTORY_LOCATIONS.find(row => row.warehouseId === normal.targetId)!.locationCode })), actor, at: time })
  assert.ok(getFinishedInventoryApplication(app.id)!.completedAt)
})


test('成衣质检出库列表从同一送检事实投影，读取不改库存且单据身份稳定', () => {
  const app = create(), before = captureFinishedInventoryState()
  const [order] = listFinishedInventoryOutboundOrders()
  assert.equal(order.id, app.outboundId); assert.equal(order.relatedOrderNo, app.applicationNo)
  assert.equal(order.orderType, '成衣质检'); assert.equal(order.status, '已出库')
  assert.equal(order.operatorName, actor.actorName); assert.equal(order.products.reduce((n, row) => n + row.quantity, 0), 80)
  assert.equal(listFinishedInventoryOutboundOrders()[0].outboundOrderNo, order.outboundOrderNo)
  assert.deepEqual(captureFinishedInventoryState(), before)
})
