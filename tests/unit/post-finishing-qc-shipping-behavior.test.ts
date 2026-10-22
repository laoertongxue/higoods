import {ensureQualityManagementRecords} from '../../src/data/fcs/quality-management-records.ts'
await ensureQualityManagementRecords()
import assert from 'node:assert/strict'
import test, { type TestContext } from 'node:test'
import * as flow from '../../src/data/fcs/post-finishing-full-flow.ts'
import * as runtime from '../../src/data/fcs/post-finishing-qc-shipping-priority-runtime.ts'
import { calculateQcShippingPriority, type PriorityStock } from '../../src/data/fcs/post-finishing-qc-shipping-priority.ts'
import { FINISHED_OUTBOUND_SEED, applyFinishedOutboundAction, emptyFinishedOutboundFilters, filterFinishedOutboundOrders, type FinishedOutboundOrder, type FinishedOutboundStatus } from '../../src/data/wls/finished-outbound-orders.ts'
import { QC_SHIPPING_STOCK_SEEDS } from '../../src/data/fcs/post-finishing-qc-shipping-seeds.ts'
import { loadSnapshot, persistSnapshot, type GarmentReplacementIdentity, type GarmentReplacementStoreSnapshot } from '../../src/data/fcs/garment-spu-replacement-records.ts'
import { paginateStandardListRows } from '../../src/components/ui/list-table-model.ts'

const nowMs = Date.parse('2026-10-21T09:00:00+07:00')
const today = '2026-10-21 23:59:59', tomorrow = '2026-10-22 23:59:59', yesterday = '2026-10-20 23:59:59'
const source = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]!
const actors = flow.POST_FINISHING_ACCEPTANCE_ACTORS
const baseOutbound = structuredClone(FINISHED_OUTBOUND_SEED[0]!)
type Sku = flow.PostFinishingAcceptanceSku

async function isolated(t: TestContext, run: () => Promise<void>): Promise<void> {
  assert.equal(typeof window, 'undefined', '这些夹具仅在隔离Node进程内运行')
  t.mock.method(Date, 'now', () => nowMs)
  const oldOrders = [...FINISHED_OUTBOUND_SEED], oldStocks = [...QC_SHIPPING_STOCK_SEEDS], oldIdentity = loadSnapshot()
  flow.resetPostFinishingFullFlow()
  FINISHED_OUTBOUND_SEED.splice(0)
  QC_SHIPPING_STOCK_SEEDS.splice(0)
  persistSnapshot({ version: 1, records: [], inventoryBatches: [], relabelTasks: [], warehouseMovements: [] })
  try { await run() } finally {
    FINISHED_OUTBOUND_SEED.splice(0, FINISHED_OUTBOUND_SEED.length, ...oldOrders)
    QC_SHIPPING_STOCK_SEEDS.splice(0, QC_SHIPPING_STOCK_SEEDS.length, ...oldStocks)
    persistSnapshot(oldIdentity)
    flow.loadPostFinishingDemoData({ persist: false })
  }
}

function createQc(index: number, quantities: Array<{ sku: Sku; quantity: number }> = [{ sku: source.skus[0]!, quantity: 10 }], send = true): flow.PostFinishingQcTask {
  const delivery = flow.registerPostFinishingFactoryReturn({
    productionOrderNo: source.productionOrderNo, executionTaskId: source.executionTaskId, returnIndex: index,
    triggerSource: '车缝正常交出', idempotencyKey: `QCU-BEHAVIOR-${index}`,
    quantities: quantities.map(line => ({ skuId: line.sku.skuId, registeredQty: line.quantity })),
    deliveryPersonName: '隔离数量契约来源', deliveryPersonPhone: '', evidenceImageUrls: [source.skus[0]!.imageUrl], actor: actors.factoryCourier, nowMs,
  })
  flow.confirmPostFinishingFactoryReturn({ deliveryId: delivery.deliveryId, actor: actors.returnConfirmer,
    firstCounts: delivery.lines.map(line => ({ skuId: line.sku.skuId, actualQty: line.registeredQty })), nowMs })
  const qc = flow.listPostFinishingFullFlowQcTasks().find(row => row.deliveryId === delivery.deliveryId)
  assert.ok(qc, '确认回货即生成真实待送检QC')
  return send ? flow.sendPostFinishingFactoryReturnToQc({ deliveryId: delivery.deliveryId, actor: actors.sender, nowMs }) : qc
}

function finishQc(qc: flow.PostFinishingQcTask, actor = actors.qcA): flow.PostFinishingQcTask {
  flow.claimPostFinishingQcTask({ qcTaskNo: qc.qcTaskNo, actor, nowMs })
  flow.submitPostFinishingQcRound({qcTaskId:qc.qcTaskId,actor,operationId:'priority-round-'+qc.qcTaskId,lines:qc.lines.map(line=>({skuId:line.sku.skuId,passedQty:line.expectedQty,defectQty:0,returnQty:0,issues:[]}))})
  flow.attachPostFinishingQcSignedPaper({qcTaskId:qc.qcTaskId,actor,url:qc.lines[0].sku.imageUrl,name:'隔离契约纸单，非真实签字'})
  return flow.completePostFinishingQcTask({qcTaskId:qc.qcTaskId,actor,processItems:[],nowMs})
}

function stock(sku: Sku | string, quantity = 0): PriorityStock {
  const code = typeof sku === 'string' ? sku : sku.skuCode
  const row = { id: `QCU-STOCK:${code}`, sku: code, warehouseId: 'WH-AC', quantity, reservations: [] }
  QC_SHIPPING_STOCK_SEEDS.push(row)
  return row
}

function demand(id: string, sku: Sku | string, quantity: number, status: FinishedOutboundStatus = '待处理', deadline = today): FinishedOutboundOrder {
  const code = typeof sku === 'string' ? sku : sku.skuCode
  return {
    ...structuredClone(baseOutbound), id, outboundOrderNo: `QCU-DN-${id}`, relatedOrderNo: `QCU-SALE-${id}`,
    warehouse: 'A&C WH', status, deadline, deadlineTimeZone: 'Asia/Jakarta', version: 1,
    shippedAt: ['已出库', '已揽收'].includes(status) ? '2026-10-21 08:00:00' : '',
    cancelledAt: status === '已取消' ? '2026-10-21 08:00:00' : '',
    products: [{ lineId: `${id}:0`, spu: typeof sku === 'string' ? 'QCU-TARGET' : sku.spuCode, sku: code,
      imageUrl: source.skus[0]!.imageUrl, quantity, pendingQuantity: 30, locations: [], inventoryUpdatedAt: '' }],
  }
}

async function documentFor(qc: flow.PostFinishingQcTask | string) {
  await runtime.preparePostFinishingQcShippingPriority()
  const doc = runtime.getQcShippingPriorityForQc(typeof qc === 'string' ? qc : qc.qcTaskId)
  assert.ok(doc)
  assert.equal(doc.ready, true, doc.issues.join(';'))
  return doc
}

function installReplacement(postQuantity: number, targetSku = 'QCU-TARGET-B'): GarmentReplacementStoreSnapshot {
  const original = source.skus[0]!
  const identity = (code: string): GarmentReplacementIdentity => ({ spuCode: code === original.skuCode ? original.spuCode : 'QCU-TARGET', spuName: original.spuName,
    skuCode: code, color: original.colorName, size: original.sizeName, imageUrl: original.imageUrl, shipmentBarcode: original.barcode,
    retailBarcode: original.barcode, suggestedRetailPrice: 100, currency: 'IDR' })
  const snapshot: GarmentReplacementStoreSnapshot = {
    version: 1, inventoryBatches: [], relabelTasks: [], warehouseMovements: [], records: [{
      replacementId: 'QCU-REPLACEMENT', replacementNo: 'QCU-REPLACEMENT', productionOrderId: source.productionOrderId,
      productionOrderNo: source.productionOrderNo, scopeKey: `${source.productionOrderId}::${original.colorName}`,
      sourceSpuCode: original.spuCode, sourceSpuName: original.spuName, sourceColor: original.colorName,
      targetSpuCode: 'QCU-TARGET', targetSpuName: original.spuName, targetColor: original.colorName, originalDemandQty: 100,
      status: 'COMPLETED', reason: '隔离契约有效替换', evidence: [], migrationAudits: [], createdAt: '2026-10-21T08:00:00+07:00', createdBy: '契约计划员', completedAt: '2026-10-21T08:30:00+07:00',
      lines: [{ lineId: 'QCU-REPLACEMENT-LINE', size: original.sizeName, originalDemandQty: 100, source: identity(original.skuCode), target: identity(targetSku),
        soldHistoryQty: 0, finishedWarehouseQty: 0, postFactoryQty: postQuantity, remainingReturnQty: 100 - postQuantity, replacementRequired: true, postRelabeledQty: postQuantity }],
    }],
  }
  persistSnapshot(snapshot)
  return snapshot
}

test('QCU-004/006：四个有效未出库状态逐态计量，取消、已出库、已揽收逐态排除', async t => isolated(t, async () => {
  const qc = createQc(1), sku = source.skus[0]!
  stock(sku)
  for (const status of ['待处理', '待拣货', '拣货完成', '已打单'] as const) {
    FINISHED_OUTBOUND_SEED.splice(0, FINISHED_OUTBOUND_SEED.length, demand('ACTIVE', sku, 7, status))
    assert.equal((await documentFor(qc)).todayTotal, 7, status)
  }
  for (const status of ['已取消', '已出库', '已揽收'] as const) {
    FINISHED_OUTBOUND_SEED.splice(0, FINISHED_OUTBOUND_SEED.length, demand('ACTIVE', sku, 4), demand('INACTIVE', sku, 100, status))
    assert.equal((await documentFor(qc)).todayTotal, 4, `${status}不得增加100件需求`)
  }
}))

test('QCU-005/008：真实取消动作使同SKU净需求减少20，重复pendingQuantity不替代多行明细量', async t => isolated(t, async () => {
  const qc = createQc(1), sku = source.skus[0]!
  stock(sku)
  const remaining = demand('REMAINING', sku, 10), cancel = demand('CANCEL', sku, 20, '已打单')
  cancel.printCount = 2
  FINISHED_OUTBOUND_SEED.push(remaining, cancel)
  assert.equal((await documentFor(qc)).todayTotal, 30)
  FINISHED_OUTBOUND_SEED[1] = applyFinishedOutboundAction(cancel, 'cancel-print', '2026-10-21 09:00:00')
  assert.equal((await documentFor(qc)).todayTotal, 10)
  assert.equal(FINISHED_OUTBOUND_SEED[1]!.printCount, 2)
  remaining.products[0]!.quantity = 1
  remaining.products.push({ ...remaining.products[0]!, lineId: 'REMAINING:1', quantity: 2 })
  assert.deepEqual(remaining.products.map(row => row.pendingQuantity), [30, 30])
  assert.equal((await documentFor(qc)).todayTotal, 3, '两行明细1+2，不是重复参考30+30')
}))

test('QCU-009：列表真实筛选和分页得到局部记录，runtime仍统计全部同SKU有效需求', async t => isolated(t, async () => {
  const qc = createQc(1), sku = source.skus[0]!
  stock(sku)
  FINISHED_OUTBOUND_SEED.push(...Array.from({ length: 20 }, (_, index) => demand(`PAGE-${index}`, sku, 1)))
  const before = await documentFor(qc)
  assert.equal(before.todayTotal, 20)
  const filters = emptyFinishedOutboundFilters()
  filters.keyword = 'QCU-DN-PAGE-19'
  const filtered = filterFinishedOutboundOrders(FINISHED_OUTBOUND_SEED, filters)
  assert.equal(filtered.length, 1)
  assert.deepEqual(await documentFor(qc), before)
  const page = paginateStandardListRows(FINISHED_OUTBOUND_SEED, 2, 10)
  assert.equal(page.rows.length, 10)
  assert.deepEqual(await documentFor(qc), before, '筛选器或当前页局部结果不成为需求来源')
}))

test('QCU-013/014：有效A换B的20件仅抵B50，旧A40缺口保留且总供给不双计', async t => isolated(t, async () => {
  const pending = createQc(1, [{ sku: source.skus[0]!, quantity: 20 }])
  const passed = finishQc(createQc(2, [{ sku: source.skus[0]!, quantity: 20 }]))
  const sku = source.skus[0]!, target = 'QCU-TARGET-B'
  const replacement = installReplacement(20, target)
  stock(sku); stock(target)
  FINISHED_OUTBOUND_SEED.push(demand('OLD-A', sku, 40), demand('TARGET-B', target, 50))
  const doc = await documentFor(pending)
  assert.equal(doc.todayTotal, 30)
  assert.ok(doc.rows.every(row => row.sku === target))
  assert.equal(flow.getPostFinishingFullFlowQcTask(passed.qcTaskId)!.lines[0]!.sku.skuCode, sku.skuCode, '原批次身份保留追溯，不重复生成新批次')
  const issues: string[] = []
  const effective = runtime.resolveQcShippingIdentity(passed, passed.lines[0]!.sku, 'post', issues, replacement)
  const result = calculateQcShippingPriority({ nowMs, demands: FINISHED_OUTBOUND_SEED.map(row => ({ id: row.products[0]!.lineId!, orderId: row.id, sku: row.products[0]!.sku, warehouseId: 'WH-AC', quantity: row.products[0]!.quantity, deadline: row.deadline, deadlineTimeZone: row.deadlineTimeZone! })),
    stocks: [], postSupplies: [{ id: `qc:${passed.qcTaskId}`, sku: effective, warehouseId: 'WH-AC', quantity: 20 }], issues })
  assert.equal(result.ready, true)
  assert.equal(result.rows.find(row => row.sku === sku.skuCode)!.today, 40)
  assert.equal(result.rows.find(row => row.sku === target)!.today, 30)
  assert.equal(result.rows.reduce((sum, row) => sum + row.postSupply, 0), 20)
  assert.equal(result.rows.reduce((sum, row) => sum + row.today, 0), 70)
}))

test('QCU-021/044：真实待送检、待质检、质检中、质检完成逐态决定展示与合格供给', async t => isolated(t, async () => {
  const sku = source.skus[0]!
  const waiting = createQc(1, [{ sku, quantity: 20 }], false)
  const pending = createQc(2, [{ sku, quantity: 40 }])
  const running = createQc(3, [{ sku, quantity: 20 }])
  flow.claimPostFinishingQcTask({ qcTaskNo: running.qcTaskNo, actor: actors.qcA, nowMs })
  const done = finishQc(createQc(4, [{ sku, quantity: 20 }]), actors.qcB)
  stock(sku)
  FINISHED_OUTBOUND_SEED.push(demand('NEED-80', sku, 80))
  await runtime.preparePostFinishingQcShippingPriority()
  assert.equal(runtime.getQcShippingPriorityForQc(waiting.qcTaskId), undefined)
  assert.equal(runtime.getQcShippingPriorityForQc(running.qcTaskId), undefined)
  assert.equal(runtime.getQcShippingPriorityForQc(done.qcTaskId), undefined)
  const doc = runtime.getQcShippingPriorityForQc(pending.qcTaskId)!
  assert.equal(doc.ready, true, doc.issues.join(';'))
  assert.equal(doc.todayTotal, 60, '仅完成QC的20件供给抵扣，不把其余未检量当合格品')
}))

test('QCU-042/045/046：今日5件高于明日100件，多SKU单据取最高星但不扩大不相关SKU范围', async t => isolated(t, async () => {
  const a = source.skus[0]!, b = source.skus[1]!
  const multi = createQc(1, [{ sku: a, quantity: 10 }, { sku: b, quantity: 10 }])
  const onlyTomorrow = createQc(2, [{ sku: a, quantity: 10 }])
  stock(a); stock(b)
  FINISHED_OUTBOUND_SEED.push(demand('TOMORROW-100', a, 100, '待处理', tomorrow), demand('TODAY-5', b, 5))
  const highest = await documentFor(multi)
  assert.equal(highest.stars, 2)
  assert.equal(highest.todayTotal, 5)
  assert.equal(highest.tomorrowTotal, 100)
  assert.equal(onlyTomorrow.lines.find(line => line.sku.skuId === b.skuId)?.expectedQty ?? 0, 0, '同生产单未实回的B行不是本批实际应检SKU')
  const limited = await documentFor(onlyTomorrow)
  assert.equal(limited.stars, 1, `只实际应检A的QC不能因B的0应检行带入今日紧急：${JSON.stringify(limited.rows)}`)
  assert.equal(limited.todayTotal, 0)
  assert.equal(limited.tomorrowTotal, 100)
  assert.ok(limited.rows.every(row => row.sku === a.skuCode))
  assert.equal(runtime.getQcShippingPriorityForProduction(source.productionOrderNo)!.stars, 2, '生产主单含另一张实际应检B的待质检QC时取两星')
  flow.claimPostFinishingQcTask({ qcTaskNo: multi.qcTaskNo, actor: actors.qcA, nowMs })
  await runtime.preparePostFinishingQcShippingPriority()
  const master = runtime.getQcShippingPriorityForProduction(source.productionOrderNo)!
  assert.deepEqual([master.stars, master.todayTotal, master.tomorrowTotal], [1, 0, 100], '含B的QC进入质检中后，生产主单不能再因其余QC的B零应检行扩大范围')
  assert.ok(master.rows.every(row => row.sku === a.skuCode))
}))

test('QCU-047/048/049：三张真实同SKU待质检QC各显示共享60，生产主单仍60而非180', async t => isolated(t, async () => {
  const sku = source.skus[0]!
  const qcs = [1, 2, 3].map(index => createQc(index, [{ sku, quantity: 20 }]))
  stock(sku)
  FINISHED_OUTBOUND_SEED.push(demand('SHARED-60', sku, 60))
  const documents = await Promise.all(qcs.map(qc => documentFor(qc)))
  assert.deepEqual(documents.map(doc => doc.todayTotal), [60, 60, 60])
  assert.deepEqual(qcs.map(qc => flow.getPostFinishingFullFlowQcTask(qc.qcTaskId)!.lines[0]!.expectedQty), [20, 20, 20])
  const master = runtime.getQcShippingPriorityForProduction(source.productionOrderNo)!
  assert.equal(master.todayTotal, 60)
  assert.equal(master.rows.filter(row => row.sku === sku.skuCode).length, 1)
}))

test('QCU-057/076：订单量、截止日、库存、QC合格、实收和身份改变后重算真实净需求', async t => isolated(t, async () => {
  const sku = source.skus[0]!, pending = createQc(1, [{ sku, quantity: 20 }])
  const inventory = stock(sku, 10)
  const order = demand('CHANGING', sku, 50)
  FINISHED_OUTBOUND_SEED.push(order)
  assert.equal((await documentFor(pending)).todayTotal, 40)
  order.products[0]!.quantity = 70; order.version++
  assert.equal((await documentFor(pending)).todayTotal, 60)
  order.deadline = tomorrow; order.version++
  let doc = await documentFor(pending)
  assert.deepEqual([doc.todayTotal, doc.tomorrowTotal, doc.stars], [0, 60, 1])
  inventory.quantity = 30
  assert.equal((await documentFor(pending)).tomorrowTotal, 40)
  const done = finishQc(createQc(2, [{ sku, quantity: 20 }]))
  assert.equal((await documentFor(pending)).tomorrowTotal, 20)
  const child = flow.getPostFinishingFullFlowOutboundOrder(done.outboundOrderId!)!
  flow.dispatchPostFinishingOutboundOrder({outboundOrderId:child.outboundOrderId,actor:actors.postOperator,nowMs})
  flow.receivePostFinishingOutboundOrder({ outboundOrderNo: child.outboundOrderNo, targetWarehouseId: 'WH-AC', actor: actors.warehouseReceiver,
    receivedQuantities: child.lines.map(line => ({ skuId: line.sku.skuId, receivedQty: line.outboundQty })), nowMs })
  assert.equal((await documentFor(pending)).tomorrowTotal, 20, '实收只是P转W，不产生第二份保障')
  const target = 'QCU-TARGET-RECOMPUTE'
  const replacement = installReplacement(20, target)
  replacement.records[0]!.lines[0]!.target.imageUrl = '/materials/pcs-reviewed/dress-blue.jpg'
  replacement.records[0]!.lines[0]!.target.spuName = '换码后成衣'
  persistSnapshot(replacement)
  stock(target)
  FINISHED_OUTBOUND_SEED.push(demand('TARGET-NEW', target, 40))
  doc = await documentFor(pending)
  assert.deepEqual([doc.todayTotal, doc.tomorrowTotal], [20, 0])
  assert.ok(doc.rows.every(row => row.sku === target))
  const targetInventory = runtime.readUnifiedQcShippingStockRows().find(row => row.sku === target && row.warehouse_id === 'WH-AC')!
  assert.equal(targetInventory.spotStock, 20)
  assert.equal(targetInventory.image, '/materials/pcs-reviewed/dress-blue.jpg', '新实收按当前有效目标SKU提供图片，不回退成原SKU图片')
  assert.equal(targetInventory.productName, '换码后成衣')
}))

test('QCU-076：取消需求不自动释放其现货锁定，剩余需求不能抢用这40件', async t => isolated(t, async () => {
  const sku = source.skus[0]!, qc = createQc(1)
  const inventory = stock(sku, 100)
  inventory.reservations.push({ id: 'QCU-RESERVED-CANCEL', orderLineId: 'CANCEL-RESERVED:0', quantity: 40 })
  const locked = demand('CANCEL-RESERVED', sku, 40, '已打单'), active = demand('OTHER-80', sku, 80)
  FINISHED_OUTBOUND_SEED.push(locked, active)
  assert.equal((await documentFor(qc)).todayTotal, 20)
  FINISHED_OUTBOUND_SEED[0] = applyFinishedOutboundAction(locked, 'cancel-print', '2026-10-21 09:00:00')
  assert.equal((await documentFor(qc)).todayTotal, 20, '取消仅移出需求，未被真实释放的占用仍锁定')
}))

test('QCU-082：先排序的SKU今日缺5、后排序SKU历史超期7，同两星主单优先显示已超期', async t => isolated(t, async () => {
  const a = source.skus[0]!, z = source.skus[1]!
  assert.ok(a.skuCode < z.skuCode)
  const qc = createQc(1, [{ sku: a, quantity: 10 }, { sku: z, quantity: 10 }])
  stock(a); stock(z)
  FINISHED_OUTBOUND_SEED.push(demand('FIRST-TODAY', a, 5), demand('LAST-OVERDUE', z, 7, '待处理', yesterday))
  const doc = await documentFor(qc)
  assert.deepEqual([doc.stars, doc.todayTotal, doc.overdueTotal, doc.tomorrowTotal], [2, 5, 7, 0])
  assert.equal(doc.label, '已超期')
  assert.equal(doc.rows.reduce((sum, row) => sum + row.today + row.overdue + row.tomorrow, 0), 12)
}))

test('QCU-001/016/017/036：创建日期及库位参考不增加供给，40现货加90后道按100/80抵成0/50', async t => isolated(t, async () => {
  const sku = source.skus[0]!, qc = createQc(1)
  stock(sku, 30)
  const order = demand('STOCK-REFERENCE', sku, 100)
  order.products[0]!.locations = [{ name: 'A1', quantity: 10 }, { name: 'A2', quantity: 20 }]
  FINISHED_OUTBOUND_SEED.push(order)
  const before = await documentFor(qc)
  assert.equal(before.todayTotal, 70, '聚合现货30和两库位10/20不能累加为60')
  order.createdAt = '2030-01-01 00:00:00'
  order.updatedAt = '2030-01-01 00:00:00'
  assert.deepEqual(await documentFor(qc), before, '创建/更新时间不替代揽收截止时间')
  const result = calculateQcShippingPriority({ nowMs,
    demands: [
      { id: 'TODAY-100', orderId: 'TODAY', sku: sku.skuCode, warehouseId: 'WH-AC', quantity: 100, deadline: today, deadlineTimeZone: 'Asia/Jakarta' },
      { id: 'TOMORROW-80', orderId: 'TOMORROW', sku: sku.skuCode, warehouseId: 'WH-AC', quantity: 80, deadline: tomorrow, deadlineTimeZone: 'Asia/Jakarta' },
    ], stocks: [{ id: 'PHYSICAL-40', sku: sku.skuCode, warehouseId: 'WH-AC', quantity: 40, reservations: [] }],
    postSupplies: [{ id: 'QUALIFIED-90', sku: sku.skuCode, warehouseId: 'WH-AC', quantity: 90 }],
  })
  assert.equal(result.ready, true)
  assert.deepEqual([result.rows[0]!.today, result.rows[0]!.tomorrow, result.rows[0]!.unusedSupply], [0, 50, 0])
}))
